package com.vnshop.paymentservice.application;

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

class PaymentPromotionServiceTest {

    @Test
    void promotesPendingPaymentEmitsLedgerAndOutboxRow() {
        UUID paymentId = UUID.randomUUID();
        InMemoryPayments payments = new InMemoryPayments();
        payments.save(pending(paymentId));
        CapturingLedger ledger = new CapturingLedger();
        CapturingOutbox outbox = new CapturingOutbox();
        PaymentPromotionService service = new PaymentPromotionService(payments, new LedgerService(ledger), outbox);

        UUID callbackId = UUID.randomUUID();
        PaymentPromotionService.PromotionResult result = service.promote(
                PaymentPromotionService.PromotionCommand.fromCallback(
                        paymentId, "STRIPE", "ch_123", callbackId, "evt_123", "hash-1"));

        assertThat(result.outcome()).isEqualTo(PaymentPromotionService.PromotionResult.Outcome.PROMOTED);
        assertThat(result.payment().status()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(result.payment().transactionRef()).isEqualTo("ch_123");
        assertThat(ledger.savedEntries).hasSize(2);
        assertThat(outbox.savedRecords).hasSize(1);
        assertThat(outbox.savedRecords.get(0).provider()).isEqualTo("STRIPE");
        assertThat(outbox.savedRecords.get(0).callbackId()).isEqualTo(callbackId);
    }

    @Test
    void manualPromotionSkipsOutboxButStillEmitsLedger() {
        UUID paymentId = UUID.randomUUID();
        InMemoryPayments payments = new InMemoryPayments();
        payments.save(pending(paymentId));
        CapturingLedger ledger = new CapturingLedger();
        CapturingOutbox outbox = new CapturingOutbox();
        PaymentPromotionService service = new PaymentPromotionService(payments, new LedgerService(ledger), outbox);

        PaymentPromotionService.PromotionResult result = service.promote(
                PaymentPromotionService.PromotionCommand.manual(paymentId, "VIETQR", "VIETQR-MANUAL-" + paymentId));

        assertThat(result.outcome()).isEqualTo(PaymentPromotionService.PromotionResult.Outcome.PROMOTED);
        assertThat(result.payment().transactionRef()).isEqualTo("VIETQR-MANUAL-" + paymentId);
        assertThat(ledger.savedEntries).hasSize(2);
        assertThat(outbox.savedRecords).isEmpty();
    }

    @Test
    void replayingPromoteOnAlreadyCompletedPaymentIsNoOp() {
        UUID paymentId = UUID.randomUUID();
        InMemoryPayments payments = new InMemoryPayments();
        payments.save(pending(paymentId).withResult(PaymentStatus.COMPLETED, "ch_first"));
        CapturingLedger ledger = new CapturingLedger();
        CapturingOutbox outbox = new CapturingOutbox();
        PaymentPromotionService service = new PaymentPromotionService(payments, new LedgerService(ledger), outbox);

        PaymentPromotionService.PromotionResult result = service.promote(
                PaymentPromotionService.PromotionCommand.fromCallback(
                        paymentId, "STRIPE", "ch_second", UUID.randomUUID(), "evt_second", "hash-2"));

        assertThat(result.outcome()).isEqualTo(PaymentPromotionService.PromotionResult.Outcome.ALREADY_COMPLETED);
        assertThat(result.payment().transactionRef()).isEqualTo("ch_first");
        assertThat(ledger.savedEntries).isEmpty();
        assertThat(outbox.savedRecords).isEmpty();
        assertThat(payments.byId.get(paymentId).transactionRef()).isEqualTo("ch_first");
    }

    @Test
    void missingPaymentReturnsNotFoundResultWithoutWrites() {
        InMemoryPayments payments = new InMemoryPayments();
        CapturingLedger ledger = new CapturingLedger();
        CapturingOutbox outbox = new CapturingOutbox();
        PaymentPromotionService service = new PaymentPromotionService(payments, new LedgerService(ledger), outbox);

        PaymentPromotionService.PromotionResult result = service.promote(
                PaymentPromotionService.PromotionCommand.manual(UUID.randomUUID(), "VIETQR", "ref"));

        assertThat(result.outcome()).isEqualTo(PaymentPromotionService.PromotionResult.Outcome.PAYMENT_NOT_FOUND);
        assertThat(result.payment()).isNull();
        assertThat(ledger.savedEntries).isEmpty();
        assertThat(outbox.savedRecords).isEmpty();
    }

    private static Payment pending(UUID paymentId) {
        return new Payment(paymentId, "ORDER-1", "BUYER-1",
                new BigDecimal("100000.00"), PaymentMethod.STRIPE, PaymentStatus.PENDING, null,
                Instant.parse("2026-05-19T00:00:00Z"));
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

    private static final class CapturingLedger implements LedgerRepositoryPort {
        private final List<LedgerEntry> savedEntries = new ArrayList<>();

        @Override
        public List<LedgerEntry> append(JournalEntry journalEntry) {
            List<LedgerEntry> entries = journalEntry.postings().stream()
                    .map(posting -> LedgerEntry.fromJournalPosting(journalEntry, posting))
                    .toList();
            savedEntries.addAll(entries);
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

    private static final class CapturingOutbox implements PaymentCallbackOutbox {
        private final List<PaymentCallbackOutboxRecord> savedRecords = new ArrayList<>();

        @Override
        public PaymentCallbackOutboxRecord save(PaymentCallbackOutboxRecord record) {
            savedRecords.add(record);
            return record;
        }

        @Override
        public List<PaymentCallbackOutboxRecord> findUnpublished(int limit) {
            return List.of();
        }

        @Override
        public void markPublished(Long id) {
        }

        @Override
        public List<PaymentCallbackOutboxRecord> findRetryable(int limit) {
            return List.of();
        }

        @Override
        public void recordFailure(Long id, int attemptCount, String error, java.time.Instant nextAttemptAt, boolean dead) {
        }
    }
}
