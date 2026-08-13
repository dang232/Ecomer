package com.vnshop.paymentservice.infrastructure.web;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.PaymentIntent;
import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.application.ledger.LedgerService;
import com.vnshop.paymentservice.domain.JournalEntry;
import com.vnshop.paymentservice.domain.LedgerEntry;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
import com.vnshop.paymentservice.domain.PaymentCallbackOutboxRecord;
import com.vnshop.paymentservice.domain.port.out.PaymentCallbackOutbox;
import com.vnshop.paymentservice.infrastructure.stripe.StripeProperties;
import com.vnshop.paymentservice.infrastructure.webhook.WebhookIdempotencyService;
import com.vnshop.paymentservice.infrastructure.stripe.StripeWebhookVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.eq;

class StripeWebhookControllerTest {

    @Test
    void promotesPendingPaymentOnSucceededEvent() {
        UUID paymentId = UUID.fromString("00000000-0000-0000-0000-0000000000aa");
        InMemoryPayments payments = new InMemoryPayments();
        payments.save(pending(paymentId).withResult(PaymentStatus.PENDING, "pi_abc"));
        CapturingLedger ledger = new CapturingLedger();
        CapturingOutbox outbox = new CapturingOutbox();
        CapturingLogStore logStore = new CapturingLogStore();
        StripeWebhookController controller = controller(payments, ledger, outbox, logStore,
                stubVerifier(succeededEvent("evt_ok", paymentId, "pi_abc")));

        ResponseEntity<ApiResponse<StripeWebhookController.StripeWebhookResponse>> response =
                controller.webhook("t=1,v1=sig", "{}");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().data().outcome()).isEqualTo("PROMOTED");
        assertThat(payments.byId.get(paymentId).status()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(payments.byId.get(paymentId).transactionRef()).isEqualTo("pi_abc");
        assertThat(ledger.savedEntries).hasSize(2);
        assertThat(outbox.savedRecords).hasSize(1);
        assertThat(logStore.savedAttempts).hasSize(2);
        assertThat(logStore.savedAttempts).extracting(PaymentCallbackAttempt::processingStatus)
                .containsExactly("RECEIVED", "PROCESSED");
    }

    @Test
    void duplicateEventIdAcksWithoutDoubleProcessing() {
        UUID paymentId = UUID.fromString("00000000-0000-0000-0000-0000000000bb");
        InMemoryPayments payments = new InMemoryPayments();
        payments.save(pending(paymentId));
        CapturingLedger ledger = new CapturingLedger();
        CapturingOutbox outbox = new CapturingOutbox();
        CapturingLogStore logStore = new CapturingLogStore();
        // Pre-seed a processed attempt so dedup hits.
        logStore.savedAttempts.add(new PaymentCallbackAttempt(
                UUID.randomUUID(), "STRIPE", "evt_dup", "any-hash", "any-sig",
                "", "{}", Instant.now(), "PROCESSED", false));

        StripeWebhookController controller = controller(payments, ledger, outbox, logStore,
                stubVerifier(succeededEvent("evt_dup", paymentId, "pi_dup")));

        ResponseEntity<ApiResponse<StripeWebhookController.StripeWebhookResponse>> response =
                controller.webhook("t=1,v1=sig", "{}");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().data().outcome()).isEqualTo("duplicate");
        assertThat(ledger.savedEntries).isEmpty();
        assertThat(outbox.savedRecords).isEmpty();
        assertThat(payments.byId.get(paymentId).status()).isEqualTo(PaymentStatus.PENDING);
    }

    @Test
    void invalidSignatureReturns400() {
        InMemoryPayments payments = new InMemoryPayments();
        StripeWebhookController controller = controller(payments, new CapturingLedger(), new CapturingOutbox(),
                new CapturingLogStore(),
                (payload, sig, secret) -> { throw new SignatureVerificationException("bad sig", "t=1,v1=bad"); });

        ResponseEntity<ApiResponse<StripeWebhookController.StripeWebhookResponse>> response =
                controller.webhook("t=1,v1=bad", "{}");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().errorCode()).isEqualTo("BAD_SIGNATURE");
    }

    @Test
    void rejectsMismatchedStripeEvidenceWithoutQueueingRetry() {
        UUID paymentId = UUID.fromString("00000000-0000-0000-0000-0000000000dd");
        InMemoryPayments payments = new InMemoryPayments();
        payments.save(pending(paymentId).withResult(PaymentStatus.PENDING, "pi_expected"));
        CapturingLogStore logStore = new CapturingLogStore();
        WebhookIdempotencyService idempotency = mock(WebhookIdempotencyService.class);
        StripeWebhookController controller = new StripeWebhookController(
                new StripeProperties(true, "sk_test", "pk_test", "whsec_x"),
                stubVerifier(eventOf("evt_mismatch", "payment_intent.succeeded",
                        paymentIntent(paymentId, "pi_mismatch", "ORDER-other", "100000"))),
                new PaymentPromotionService(payments, new LedgerService(new CapturingLedger()), new CapturingOutbox()),
                logStore,
                idempotency);

        ResponseEntity<ApiResponse<StripeWebhookController.StripeWebhookResponse>> response =
                controller.webhook("t=1,v1=sig", "{}");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().errorCode()).isEqualTo("BAD_PAYLOAD");
        verify(idempotency, never()).storePendingForRetry(any(), any(), any(), any());
        assertThat(payments.byId.get(paymentId).status()).isEqualTo(PaymentStatus.PENDING);
    }

    @Test
    void nonSucceededEventTypeIsAckedWithoutPromotion() {
        UUID paymentId = UUID.fromString("00000000-0000-0000-0000-0000000000cc");
        InMemoryPayments payments = new InMemoryPayments();
        payments.save(pending(paymentId));
        CapturingLogStore logStore = new CapturingLogStore();
        StripeWebhookController controller = controller(payments, new CapturingLedger(), new CapturingOutbox(),
                logStore,
                stubVerifier(eventOf("evt_fail", "payment_intent.payment_failed", paymentIntent(paymentId, "pi_fail"))));

        ResponseEntity<ApiResponse<StripeWebhookController.StripeWebhookResponse>> response =
                controller.webhook("t=1,v1=sig", "{}");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().data().outcome()).isEqualTo("payment_intent.payment_failed");
        assertThat(payments.byId.get(paymentId).status()).isEqualTo(PaymentStatus.PENDING);
        assertThat(logStore.savedAttempts).hasSize(1);
        assertThat(logStore.savedAttempts.get(0).processingStatus()).isEqualTo("IGNORED");
    }

    @Test
    void chargebackEventIsNotGloballyMarkedByGeneralStripeController() {
        WebhookIdempotencyService idempotency = mock(WebhookIdempotencyService.class);
        StripeWebhookController controller = new StripeWebhookController(
                new StripeProperties(true, "sk_test", "pk_test", "whsec_x"),
                stubVerifier(eventOf("evt_dispute", "charge.dispute.created",
                        paymentIntent(UUID.randomUUID(), "pi_dispute"))),
                new PaymentPromotionService(new InMemoryPayments(),
                        new LedgerService(new CapturingLedger()), new CapturingOutbox()),
                new CapturingLogStore(),
                idempotency);

        ResponseEntity<ApiResponse<StripeWebhookController.StripeWebhookResponse>> response =
                controller.webhook("t=1,v1=sig", "{}");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().data().outcome()).isEqualTo("charge.dispute.created");
        verify(idempotency, never()).isAlreadyProcessed(any(), eq("STRIPE"));
        verify(idempotency, never()).markProcessed(any(), eq("STRIPE"), eq("charge.dispute.created"));
    }

    private static StripeWebhookController controller(
            PaymentRepositoryPort payments, LedgerRepositoryPort ledger,
            PaymentCallbackOutbox outbox, PaymentCallbackLogStore logStore,
            StripeWebhookVerifier verifier) {
        StripeProperties props = new StripeProperties(true, "sk_test", "pk_test", "whsec_x");
        PaymentPromotionService promotion = new PaymentPromotionService(payments, new LedgerService(ledger), outbox);
        WebhookIdempotencyService noopIdempotency = mock(WebhookIdempotencyService.class);
        return new StripeWebhookController(props, verifier, promotion, logStore, noopIdempotency);
    }

    private static StripeWebhookVerifier stubVerifier(Event event) {
        return (payload, sig, secret) -> event;
    }

    private static Event succeededEvent(String eventId, UUID paymentId, String intentId) {
        return eventOf(eventId, "payment_intent.succeeded", paymentIntent(paymentId, intentId));
    }

    private static Event eventOf(String id, String type, PaymentIntent intent) {
        Event event = mock(Event.class);
        when(event.getId()).thenReturn(id);
        when(event.getType()).thenReturn(type);
        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(deserializer.getObject()).thenReturn(Optional.of(intent));
        when(event.getDataObjectDeserializer()).thenReturn(deserializer);
        return event;
    }

    private static PaymentIntent paymentIntent(UUID paymentId, String intentId) {
        return paymentIntent(paymentId, intentId, "ORDER-" + paymentId, "100000");
    }

    private static PaymentIntent paymentIntent(UUID paymentId, String intentId, String orderId, String vndAmount) {
        PaymentIntent intent = new PaymentIntent();
        intent.setId(intentId);
        Map<String, String> meta = new HashMap<>();
        meta.put("paymentId", paymentId.toString());
        meta.put("orderId", orderId);
        meta.put("vndAmount", vndAmount);
        intent.setMetadata(meta);
        intent.setAmount(10_000L);
        intent.setCurrency("usd");
        return intent;
    }

    private static Payment pending(UUID paymentId) {
        return new Payment(paymentId, "ORDER-" + paymentId, "BUYER-1",
                new BigDecimal("100000"), PaymentMethod.STRIPE, PaymentStatus.PENDING, null,
                Instant.parse("2026-05-19T00:00:00Z"), new BigDecimal("100.00"), "USD",
                new BigDecimal("0.001"), Instant.parse("2026-05-19T00:00:00Z"));
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

    private static final class CapturingLogStore implements PaymentCallbackLogStore {
        private final List<PaymentCallbackAttempt> savedAttempts = new ArrayList<>();

        @Override
        public Optional<PaymentCallbackAttempt> findProcessed(String provider, String eventId, String payloadHash, String signatureHash) {
            return savedAttempts.stream()
                    .filter(a -> a.provider().equals(provider))
                    .filter(a -> a.eventId().equals(eventId))
                    .filter(a -> "PROCESSED".equals(a.processingStatus()) || "FAILED".equals(a.processingStatus()) || "IGNORED".equals(a.processingStatus()))
                    .filter(a -> !a.duplicateReplay())
                    .findFirst();
        }

        @Override
        public PaymentCallbackAttempt save(PaymentCallbackAttempt attempt) {
            savedAttempts.add(attempt);
            return attempt;
        }
    }
}
