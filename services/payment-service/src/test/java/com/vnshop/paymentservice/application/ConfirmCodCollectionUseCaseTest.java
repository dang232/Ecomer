package com.vnshop.paymentservice.application;

import com.vnshop.paymentservice.application.ledger.LedgerService;
import com.vnshop.paymentservice.domain.JournalEntry;
import com.vnshop.paymentservice.domain.LedgerEntry;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentCallbackOutboxRecord;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.PaymentCallbackOutbox;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
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

class ConfirmCodCollectionUseCaseTest {

    @Test
    void promotesVerifiedCollectionOnceAndWritesPaymentCallbackOutbox() {
        UUID paymentId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        InMemoryPayments payments = new InMemoryPayments(payment(paymentId));
        CapturingOutbox outbox = new CapturingOutbox();
        CapturingCallbackLog callbacks = new CapturingCallbackLog();
        ConfirmCodCollectionUseCase useCase = useCase(payments, outbox, callbacks);

        ConfirmCodCollectionUseCase.Command command = command(collectionId, "ORDER-1", new BigDecimal("125000"));

        ConfirmCodCollectionUseCase.Result first = useCase.confirm(command);
        ConfirmCodCollectionUseCase.Result duplicate = useCase.confirm(command);

        assertThat(first.outcome()).isEqualTo(ConfirmCodCollectionUseCase.Result.Outcome.PROMOTED);
        assertThat(first.payment().status()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(first.payment().codCollectionEventId()).isEqualTo(collectionId.toString());
        assertThat(duplicate.outcome()).isEqualTo(ConfirmCodCollectionUseCase.Result.Outcome.ALREADY_CONFIRMED);
        assertThat(outbox.savedRecords).hasSize(1);
        assertThat(callbacks.savedAttempts).hasSize(1);
    }

    @Test
    void rejectsCollectionWhenCarrierAmountDoesNotMatchExpectedPayment() {
        InMemoryPayments payments = new InMemoryPayments(payment(UUID.randomUUID()));
        CapturingOutbox outbox = new CapturingOutbox();
        CapturingCallbackLog callbacks = new CapturingCallbackLog();

        assertThatThrownBy(() -> useCase(payments, outbox, callbacks).confirm(
                command(UUID.randomUUID(), "ORDER-1", new BigDecimal("124999"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("amount");

        assertThat(outbox.savedRecords).isEmpty();
        assertThat(callbacks.savedAttempts).isEmpty();
        assertThat(payments.findByOrderId("ORDER-1").orElseThrow().status())
                .isEqualTo(PaymentStatus.AWAITING_COLLECTION);
    }

    private static ConfirmCodCollectionUseCase useCase(
            InMemoryPayments payments,
            CapturingOutbox outbox,
            CapturingCallbackLog callbacks) {
        return new ConfirmCodCollectionUseCase(
                payments,
                new PaymentPromotionService(payments, new LedgerService(new CapturingLedger()), outbox),
                callbacks);
    }

    private static ConfirmCodCollectionUseCase.Command command(UUID collectionId, String orderId, BigDecimal amount) {
        return new ConfirmCodCollectionUseCase.Command(
                collectionId,
                UUID.randomUUID(),
                orderId,
                "GHN",
                amount,
                "VND",
                Instant.parse("2026-07-24T10:05:00Z"));
    }

    private static Payment payment(UUID paymentId) {
        return new Payment(paymentId, "ORDER-1", "BUYER-1", new BigDecimal("125000"),
                PaymentMethod.COD, PaymentStatus.AWAITING_COLLECTION, "COD-" + paymentId,
                Instant.parse("2026-07-24T10:00:00Z"));
    }

    private static final class InMemoryPayments implements PaymentRepositoryPort {
        private final Map<UUID, Payment> byId = new HashMap<>();

        private InMemoryPayments(Payment payment) {
            byId.put(payment.paymentId(), payment);
        }

        @Override public Payment save(Payment payment) { byId.put(payment.paymentId(), payment); return payment; }
        @Override public Optional<Payment> findById(UUID paymentId) { return Optional.ofNullable(byId.get(paymentId)); }
        @Override public Optional<Payment> findByOrderId(String orderId) {
            return byId.values().stream().filter(payment -> payment.orderId().equals(orderId)).findFirst();
        }
        @Override public List<Payment> findByStatus(PaymentStatus status) { return List.of(); }
        @Override public List<Payment> findByMethodAndStatusAndCreatedAtBefore(
                PaymentMethod method, PaymentStatus status, Instant before) { return List.of(); }
    }

    private static final class CapturingOutbox implements PaymentCallbackOutbox {
        private final List<PaymentCallbackOutboxRecord> savedRecords = new ArrayList<>();
        @Override public PaymentCallbackOutboxRecord save(PaymentCallbackOutboxRecord record) {
            savedRecords.add(record); return record;
        }
        @Override public List<PaymentCallbackOutboxRecord> findUnpublished(int limit) { return List.of(); }
        @Override public List<PaymentCallbackOutboxRecord> findRetryable(int limit) { return List.of(); }
        @Override public void markPublished(Long id) { }
        @Override public void recordFailure(Long id, int attemptCount, String error, Instant nextAttemptAt, boolean dead) { }
    }

    private static final class CapturingCallbackLog implements PaymentCallbackLogStore {
        private final List<PaymentCallbackAttempt> savedAttempts = new ArrayList<>();
        @Override public Optional<PaymentCallbackAttempt> findProcessed(String provider, String eventId, String payloadHash, String signatureHash) {
            return savedAttempts.stream().filter(attempt -> attempt.eventId().equals(eventId)).findFirst();
        }
        @Override public PaymentCallbackAttempt save(PaymentCallbackAttempt attempt) {
            savedAttempts.add(attempt); return attempt;
        }
    }

    private static final class CapturingLedger implements LedgerRepositoryPort {
        @Override public List<LedgerEntry> append(JournalEntry journalEntry) {
            return journalEntry.postings().stream().map(posting -> LedgerEntry.fromJournalPosting(journalEntry, posting)).toList();
        }
        @Override public List<LedgerEntry> findByOrderId(String orderId) { return List.of(); }
        @Override public List<LedgerEntry> findByJournalId(UUID journalId) { return List.of(); }
    }
}
