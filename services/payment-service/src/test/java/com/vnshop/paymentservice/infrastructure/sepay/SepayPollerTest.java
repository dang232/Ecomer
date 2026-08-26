package com.vnshop.paymentservice.infrastructure.sepay;

import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.application.ledger.LedgerService;
import com.vnshop.paymentservice.domain.JournalEntry;
import com.vnshop.paymentservice.domain.LedgerEntry;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.domain.PaymentCallbackOutboxRecord;
import com.vnshop.paymentservice.domain.port.out.PaymentCallbackOutbox;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SepayPollerTest {

    @Test
    void rejectsBlankApiKeyAtConstruction() {
        SepayProperties props = new SepayProperties(true, "", "ACCT-1", "https://sepay.example", 30, null);

        assertThatThrownBy(() -> new SepayPoller(props,
                cursor -> empty(), new InMemoryCursorRepo(), new InMemoryPayments(),
                promotionService(new InMemoryPayments())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("apiKey");
    }

    @Test
    void matchedMemoPromotesPaymentAndAdvancesCursor() {
        UUID paymentId = UUID.fromString("00000000-0000-0000-0000-000000000111");
        InMemoryPayments payments = new InMemoryPayments();
        payments.save(pendingVietQr(paymentId));
        InMemoryCursorRepo cursor = new InMemoryCursorRepo();
        StubClient client = new StubClient(List.of(
                tx("TX-100", "100000", "Chuyen khoan " + paymentId)));

        new SepayPoller(props(), client, cursor, payments, promotionService(payments)).poll();

        assertThat(payments.byId.get(paymentId).status()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(payments.byId.get(paymentId).transactionRef()).isEqualTo("TX-100");
        assertThat(cursor.value).isEqualTo("TX-100");
    }

    @Test
    void unmatchedMemoLeavesCursorUnchangedForRetry() {
        InMemoryPayments payments = new InMemoryPayments();
        InMemoryCursorRepo cursor = new InMemoryCursorRepo();
        StubClient client = new StubClient(List.of(
                tx("TX-200", "100000", "Chuyen khoan ngan hang")));

        new SepayPoller(props(), client, cursor, payments, promotionService(payments)).poll();

        assertThat(cursor.value).isNull();
    }


    @Test
    void emptyTransactionListIsNoOp() {
        InMemoryPayments payments = new InMemoryPayments();
        InMemoryCursorRepo cursor = new InMemoryCursorRepo();
        cursor.value = "TX-PREV";
        StubClient client = new StubClient(List.of());

        new SepayPoller(props(), client, cursor, payments, promotionService(payments)).poll();

        assertThat(cursor.value).isEqualTo("TX-PREV");
    }

    @Test
    void clientFailureSwallowedSoOneOutageDoesntKillThePoller() {
        InMemoryPayments payments = new InMemoryPayments();
        InMemoryCursorRepo cursor = new InMemoryCursorRepo();
        SepayClient failing = c -> { throw new RuntimeException("connection refused"); };

        new SepayPoller(props(), failing, cursor, payments, promotionService(payments)).poll();

        assertThat(cursor.value).isNull();
    }

    @Test
    void skipsNonVietQrPayment() {
        UUID paymentId = UUID.fromString("00000000-0000-0000-0000-000000000333");
        InMemoryPayments payments = new InMemoryPayments();
        payments.save(new Payment(paymentId, "ORDER-X", "BUYER-1",
                new BigDecimal("100000"), PaymentMethod.STRIPE, PaymentStatus.PENDING, null,
                Instant.parse("2026-05-19T00:00:00Z")));
        InMemoryCursorRepo cursor = new InMemoryCursorRepo();
        StubClient client = new StubClient(List.of(
                tx("TX-300", "100000", "Chuyen " + paymentId)));

        new SepayPoller(props(), client, cursor, payments, promotionService(payments)).poll();

        assertThat(payments.byId.get(paymentId).status()).isEqualTo(PaymentStatus.PENDING);
        assertThat(cursor.value).isNull();
    }

    private static PaymentPromotionService promotionService(PaymentRepositoryPort payments) {
        return new PaymentPromotionService(payments, new LedgerService(new NoopLedger()), new NoopOutbox());
    }

    private static SepayProperties props() {
        return new SepayProperties(true, "key-1", "ACCT-1", "https://sepay.example", 30, null);
    }

    private static SepayTransactionsResponse empty() {
        return new SepayTransactionsResponse(0, null, List.of());
    }

    private static SepayTransactionsResponse.SepayTransaction tx(String id, String amount, String memo) {
        return new SepayTransactionsResponse.SepayTransaction(id, amount, memo);
    }

    private static Payment pendingVietQr(UUID paymentId) {
        return new Payment(paymentId, "ORDER-" + paymentId, "BUYER-1",
                new BigDecimal("100000"), PaymentMethod.VIETQR, PaymentStatus.PENDING, null,
                Instant.parse("2026-05-19T00:00:00Z"));
    }

    private static final class StubClient implements SepayClient {
        private final List<SepayTransactionsResponse.SepayTransaction> transactions;

        StubClient(List<SepayTransactionsResponse.SepayTransaction> transactions) {
            this.transactions = transactions;
        }

        @Override
        public SepayTransactionsResponse listTransactions(String sinceId) {
            return new SepayTransactionsResponse(0, null, transactions);
        }
    }

    private static final class InMemoryCursorRepo implements SepayCursorRepository {
        private String value;

        @Override
        public Optional<String> readCursor() {
            return Optional.ofNullable(value);
        }

        @Override
        public void writeCursor(String lastTxId) {
            value = lastTxId;
        }
    }

    private static final class InMemoryPayments implements PaymentRepositoryPort {
        private final Map<UUID, Payment> byId = new HashMap<>();

        @Override
        public Payment save(Payment payment) {
            byId.put(payment.paymentId(), payment);
            return payment;
        }

        @Override
        public Optional<Payment> findById(UUID paymentId) {
            return Optional.ofNullable(byId.get(paymentId));
        }

        @Override
        public Optional<Payment> findByOrderId(String orderId) {
            return byId.values().stream().filter(p -> p.orderId().equals(orderId)).findFirst();
        }

        @Override
        public List<Payment> findByMethodAndStatusAndCreatedAtBefore(com.vnshop.paymentservice.domain.PaymentMethod method, PaymentStatus status, java.time.Instant before) {
            return List.of();
        }

        public List<Payment> findByStatus(PaymentStatus status) {
            return byId.values().stream().filter(p -> p.status() == status).toList();
        }
    }

    private static final class NoopLedger implements LedgerRepositoryPort {
        @Override
        public List<LedgerEntry> append(JournalEntry journalEntry) {
            List<LedgerEntry> entries = new ArrayList<>();
            for (var posting : journalEntry.postings()) {
                entries.add(LedgerEntry.fromJournalPosting(journalEntry, posting));
            }
            return entries;
        }

        @Override
        public List<LedgerEntry> findByOrderId(String orderId) {
            return List.of();
        }

        @Override
        public List<LedgerEntry> findByJournalId(UUID journalId) {
            return List.of();
        }
    }

    private static final class NoopOutbox implements PaymentCallbackOutbox {
        @Override
        public PaymentCallbackOutboxRecord save(PaymentCallbackOutboxRecord record) {
            return record;
        }

        @Override
        public List<PaymentCallbackOutboxRecord> findUnpublished(int limit) {
            return List.of();
        }

        @Override
        public List<PaymentCallbackOutboxRecord> findRetryable(int limit) {
            return List.of();
        }

        @Override
        public void markPublished(Long id) {
        }

        @Override
        public void recordFailure(Long id, int attemptCount, String error, java.time.Instant nextAttemptAt, boolean dead) {
        }
    }
}
