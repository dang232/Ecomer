package com.vnshop.orderservice.infrastructure.event.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.RefundLedgerEntry;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.ReturnStatus;
import com.vnshop.orderservice.domain.port.out.RefundLedgerRepositoryPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PaymentRefundedListenerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void marksReturnRefundedAndRecordsLedgerEntry() {
        UUID returnId = UUID.randomUUID();
        InMemoryReturnRepo returns = new InMemoryReturnRepo();
        InMemoryRefundLedgerRepo ledger = new InMemoryRefundLedgerRepo();
        returns.save(completedReturn(returnId));
        PaymentRefundedListener listener = listener(returns, ledger);

        listener.onPaymentRefunded(eventJson(returnId, "REFUND-1", "100000"));

        Return saved = returns.findById(returnId).orElseThrow();
        assertThat(saved.status()).isEqualTo(ReturnStatus.REFUNDED);
        assertThat(saved.resolvedAt()).isNotNull();
        assertThat(ledger.rows).containsKey("REFUND-1");
        assertThat(ledger.rows.get("REFUND-1").amount()).isEqualByComparingTo("100000");
    }

    @Test
    void ignoresDuplicateRefundEventWithoutSavingTwice() {
        UUID returnId = UUID.randomUUID();
        InMemoryReturnRepo returns = new InMemoryReturnRepo();
        InMemoryRefundLedgerRepo ledger = new InMemoryRefundLedgerRepo();
        Return refunded = completedReturn(returnId);
        refunded.markRefunded();
        returns.save(refunded);
        ledger.save(new RefundLedgerEntry("REFUND-1", UUID.randomUUID(), returnId, "seller-1",
                new BigDecimal("100000"), "VND", Instant.now(), "COMPLETED"));
        returns.saveCount = 0;
        ledger.saveCount = 0;
        PaymentRefundedListener listener = listener(returns, ledger);

        listener.onPaymentRefunded(eventJson(returnId, "REFUND-1", "100000"));

        assertThat(returns.saveCount).isZero();
        assertThat(ledger.saveCount).isZero();
    }

    @Test
    void recordsRefundEvenWhenReturnIsNotCompletedYet() {
        UUID returnId = UUID.randomUUID();
        InMemoryReturnRepo returns = new InMemoryReturnRepo();
        InMemoryRefundLedgerRepo ledger = new InMemoryRefundLedgerRepo();
        returns.save(new Return(returnId, UUID.randomUUID().toString(), 1L, "buyer-1", "broken"));
        returns.saveCount = 0;
        PaymentRefundedListener listener = listener(returns, ledger);

        listener.onPaymentRefunded(eventJson(returnId, "REFUND-1", "100000"));

        assertThat(returns.findById(returnId).orElseThrow().status()).isEqualTo(ReturnStatus.REQUESTED);
        assertThat(returns.saveCount).isZero();
        assertThat(ledger.rows).containsKey("REFUND-1");
    }

    @Test
    void recordsOrderLevelCompensationWithoutReturnId() {
        InMemoryReturnRepo returns = new InMemoryReturnRepo();
        InMemoryRefundLedgerRepo ledger = new InMemoryRefundLedgerRepo();
        PaymentRefundedListener listener = listener(returns, ledger);
        String orderId = UUID.randomUUID().toString();

        listener.onPaymentRefunded("{\"orderId\":\"" + orderId
                + "\",\"refundId\":\"REFUND-ORDER-1\",\"amount\":\"250000\","
                + "\"currency\":\"VND\",\"status\":\"COMPLETED\"}");

        RefundLedgerEntry entry = ledger.rows.get("REFUND-ORDER-1");
        assertThat(entry).isNotNull();
        assertThat(entry.orderId()).isEqualTo(UUID.fromString(orderId));
        assertThat(entry.returnId()).isNull();
    }

    @Test
    void skipsWhenReturnMissingButKeepsLedgerEvidence() {
        InMemoryReturnRepo returns = new InMemoryReturnRepo();
        InMemoryRefundLedgerRepo ledger = new InMemoryRefundLedgerRepo();
        PaymentRefundedListener listener = listener(returns, ledger);

        listener.onPaymentRefunded(eventJson(UUID.randomUUID(), "REFUND-1", "100000"));

        assertThat(returns.saveCount).isZero();
        assertThat(ledger.rows).containsKey("REFUND-1");
    }

    @Test
    void keepsFinancialLedgerWhenOptionalReturnIdIsMalformed() {
        InMemoryReturnRepo returns = new InMemoryReturnRepo();
        InMemoryRefundLedgerRepo ledger = new InMemoryRefundLedgerRepo();
        PaymentRefundedListener listener = listener(returns, ledger);

        listener.onPaymentRefunded("{\"returnId\":\"not-a-uuid\",\"orderId\":\""
                + UUID.randomUUID() + "\",\"refundId\":\"R-1\",\"amount\":\"100000\","
                + "\"currency\":\"VND\"}");

        assertThat(returns.saveCount).isZero();
        assertThat(ledger.rows.get("R-1")).isNotNull();
        assertThat(ledger.rows.get("R-1").returnId()).isNull();
    }

    @Test
    void sendsMalformedFinancialEventsToRetryAndDltPath() {
        InMemoryReturnRepo returns = new InMemoryReturnRepo();
        InMemoryRefundLedgerRepo ledger = new InMemoryRefundLedgerRepo();
        PaymentRefundedListener listener = listener(returns, ledger);

        assertThatThrownBy(() -> listener.onPaymentRefunded("{\"orderId\":\""
                + UUID.randomUUID() + "\",\"amount\":\"100000\",\"currency\":\"VND\"}"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("refundId");

        assertThat(returns.saveCount).isZero();
        assertThat(ledger.saveCount).isZero();
    }

    @Test
    void ignoresNonCompletedRefundWithoutCreatingFinancialEvidence() {
        InMemoryReturnRepo returns = new InMemoryReturnRepo();
        InMemoryRefundLedgerRepo ledger = new InMemoryRefundLedgerRepo();
        PaymentRefundedListener listener = listener(returns, ledger);

        listener.onPaymentRefunded("{\"orderId\":\"" + UUID.randomUUID()
                + "\",\"refundId\":\"PENDING-1\",\"amount\":\"100000\","
                + "\"currency\":\"VND\",\"status\":\"PENDING\"}");

        assertThat(ledger.rows).doesNotContainKey("PENDING-1");
    }

    private PaymentRefundedListener listener(InMemoryReturnRepo returns, InMemoryRefundLedgerRepo ledger) {
        return new PaymentRefundedListener(returns, ledger, objectMapper, Clock.systemUTC());
    }

    private static Return completedReturn(UUID returnId) {
        return new Return(returnId, UUID.randomUUID().toString(), 1L, "buyer-1", "broken",
                ReturnStatus.COMPLETED, Instant.now().minusSeconds(60), Instant.now().minusSeconds(30));
    }

    private String eventJson(UUID returnId, String refundId, String amount) {
        return String.format(
                "{\"returnId\":\"%s\",\"orderId\":\"%s\",\"sellerId\":\"seller-1\","
                        + "\"refundId\":\"%s\",\"amount\":\"%s\",\"currency\":\"VND\","
                        + "\"status\":\"COMPLETED\"}",
                returnId, UUID.randomUUID(), refundId, amount);
    }

    private static final class InMemoryReturnRepo implements ReturnRepositoryPort {
        private final Map<UUID, Return> rows = new HashMap<>();
        int saveCount;

        @Override
        public Return save(Return orderReturn) {
            saveCount++;
            rows.put(orderReturn.returnId(), orderReturn);
            return orderReturn;
        }

        @Override
        public Optional<Return> findById(UUID returnId) {
            return Optional.ofNullable(rows.get(returnId));
        }

        @Override
        public List<Return> findByBuyerId(String buyerId) {
            return List.of();
        }

        @Override
        public List<Return> findBySellerId(String sellerId) {
            return List.of();
        }

        @Override
        public Optional<Return> findBySubOrderId(Long subOrderId) {
            return Optional.empty();
        }
    }

    private static final class InMemoryRefundLedgerRepo implements RefundLedgerRepositoryPort {
        private final Map<String, RefundLedgerEntry> rows = new HashMap<>();
        int saveCount;

        @Override
        public boolean existsByRefundId(String refundId) {
            return rows.containsKey(refundId);
        }

        @Override
        public RefundLedgerEntry save(RefundLedgerEntry entry) {
            saveCount++;
            rows.put(entry.refundId(), entry);
            return entry;
        }

        @Override
        public BigDecimal sumByOrderCreatedAtBetween(Instant startInclusive, Instant endInclusive) {
            return BigDecimal.ZERO;
        }

        @Override
        public BigDecimal sumByOrderCreatedAtBetweenAndRefundedAtAtMost(
                Instant startInclusive, Instant endInclusive, Instant asOf) {
            return BigDecimal.ZERO;
        }
    }
}
