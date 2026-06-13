package com.vnshop.orderservice.infrastructure.event.payment;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.ReturnStatus;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
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
    void marksReturnRefundedWhenStatusCompleted() {
        UUID returnId = UUID.randomUUID();
        InMemoryReturnRepo repo = new InMemoryReturnRepo();
        repo.save(completedReturn(returnId));
        PaymentRefundedListener listener = new PaymentRefundedListener(repo, objectMapper);

        listener.onPaymentRefunded(eventJson(returnId, "REFUND-1"));

        Return saved = repo.findById(returnId).orElseThrow();
        assertThat(saved.status()).isEqualTo(ReturnStatus.REFUNDED);
        assertThat(saved.resolvedAt()).isNotNull();
    }

    @Test
    void idempotentWhenAlreadyRefunded() {
        UUID returnId = UUID.randomUUID();
        InMemoryReturnRepo repo = new InMemoryReturnRepo();
        Return refunded = completedReturn(returnId);
        refunded.markRefunded();
        repo.save(refunded);
        repo.saveCount = 0;
        PaymentRefundedListener listener = new PaymentRefundedListener(repo, objectMapper);

        listener.onPaymentRefunded(eventJson(returnId, "REFUND-1"));

        assertThat(repo.saveCount).isZero();
    }

    @Test
    void skipsWhenReturnNotCompleted() {
        UUID returnId = UUID.randomUUID();
        InMemoryReturnRepo repo = new InMemoryReturnRepo();
        // REQUESTED — payment.refunded arrived before the seller completed the return
        repo.save(new Return(returnId, UUID.randomUUID().toString(), 1L, "buyer-1", "broken"));
        repo.saveCount = 0;
        PaymentRefundedListener listener = new PaymentRefundedListener(repo, objectMapper);

        listener.onPaymentRefunded(eventJson(returnId, "REFUND-1"));

        assertThat(repo.findById(returnId).orElseThrow().status()).isEqualTo(ReturnStatus.REQUESTED);
        assertThat(repo.saveCount).isZero();
    }

    @Test
    void skipsWhenReturnMissing() {
        InMemoryReturnRepo repo = new InMemoryReturnRepo();
        PaymentRefundedListener listener = new PaymentRefundedListener(repo, objectMapper);

        listener.onPaymentRefunded(eventJson(UUID.randomUUID(), "REFUND-1"));

        assertThat(repo.saveCount).isZero();
    }

    @Test
    void skipsMalformedReturnId() {
        InMemoryReturnRepo repo = new InMemoryReturnRepo();
        PaymentRefundedListener listener = new PaymentRefundedListener(repo, objectMapper);

        listener.onPaymentRefunded("{\"returnId\":\"not-a-uuid\",\"refundId\":\"R-1\"}");

        assertThat(repo.saveCount).isZero();
    }

    @Test
    void skipsMissingReturnId() {
        InMemoryReturnRepo repo = new InMemoryReturnRepo();
        PaymentRefundedListener listener = new PaymentRefundedListener(repo, objectMapper);

        listener.onPaymentRefunded("{\"refundId\":\"R-1\"}");

        assertThat(repo.saveCount).isZero();
    }

    private static Return completedReturn(UUID returnId) {
        return new Return(returnId, UUID.randomUUID().toString(), 1L, "buyer-1", "broken",
                ReturnStatus.COMPLETED, Instant.now().minusSeconds(60), Instant.now().minusSeconds(30));
    }

    private String eventJson(UUID returnId, String refundId) {
        return String.format(
                "{\"returnId\":\"%s\",\"orderId\":\"%s\",\"refundId\":\"%s\",\"status\":\"COMPLETED\"}",
                returnId, UUID.randomUUID(), refundId);
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
        public Optional<Return> findBySubOrderId(Long subOrderId) {
            return Optional.empty();
        }
    }
}
