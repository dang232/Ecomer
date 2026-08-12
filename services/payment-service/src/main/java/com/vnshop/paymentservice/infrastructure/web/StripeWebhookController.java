package com.vnshop.paymentservice.infrastructure.web;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackHasher;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
import com.vnshop.paymentservice.infrastructure.stripe.StripeProperties;
import com.vnshop.paymentservice.infrastructure.stripe.StripeWebhookVerifier;
import com.vnshop.paymentservice.infrastructure.webhook.WebhookIdempotencyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Stripe webhook receiver. Lives at {@code POST /payment/stripe/webhook} —
 * permitted on the API gateway because Stripe authenticates the request via
 * the {@code Stripe-Signature} HMAC, not a buyer JWT.
 *
 * <p>Local dev wiring: run {@code stripe listen --forward-to
 * http://localhost:8092/payment/stripe/webhook}; the CLI prints a
 * {@code whsec_…} secret to paste into {@code STRIPE_WEBHOOK_SECRET}.
 *
 * <p>Idempotency: dedup goes through {@link PaymentCallbackLogStore} keyed off
 * {@code provider="STRIPE"} + {@code event.id}. A replayed event with the same
 * id is acknowledged with 200 but never promotes the payment a second time.
 */
@RestController
@RequestMapping("/payment/stripe")
@ConditionalOnProperty(name = "payment.stripe.enabled", havingValue = "true")
public class StripeWebhookController {
    private static final Logger log = LoggerFactory.getLogger(StripeWebhookController.class);

    private final StripeProperties properties;
    private final StripeWebhookVerifier verifier;
    private final PaymentPromotionService promotionService;
    private final PaymentCallbackLogStore callbackLogStore;
    private final WebhookIdempotencyService webhookIdempotencyService;

    public StripeWebhookController(
            StripeProperties properties,
            StripeWebhookVerifier verifier,
            PaymentPromotionService promotionService,
            PaymentCallbackLogStore callbackLogStore,
            WebhookIdempotencyService webhookIdempotencyService) {
        this.properties = Objects.requireNonNull(properties, "properties is required");
        this.verifier = Objects.requireNonNull(verifier, "verifier is required");
        this.promotionService = Objects.requireNonNull(promotionService, "promotionService is required");
        this.callbackLogStore = Objects.requireNonNull(callbackLogStore, "callbackLogStore is required");
        this.webhookIdempotencyService = Objects.requireNonNull(webhookIdempotencyService, "webhookIdempotencyService is required");
    }

    @PostMapping("/webhook")
    public ResponseEntity<ApiResponse<StripeWebhookResponse>> webhook(
            @RequestHeader(value = "Stripe-Signature", required = false) String signatureHeader,
            @RequestBody String payload) {
        Event event;
        try {
            event = verifier.constructEvent(payload, signatureHeader, properties.webhookSecret());
        } catch (SignatureVerificationException ex) {
            log.warn("stripe-webhook-bad-signature: {}", ex.getMessage());
            return ResponseEntity.badRequest().body(ApiResponse.error("invalid signature", "BAD_SIGNATURE"));
        } catch (RuntimeException ex) {
            log.warn("stripe-webhook-malformed-payload: {}", ex.getMessage());
            return ResponseEntity.badRequest().body(ApiResponse.error("malformed payload", "BAD_REQUEST"));
        }

        // Webhook-level dedup: same event delivered twice → 200 immediately.
        if (webhookIdempotencyService.isAlreadyProcessed(event.getId(), "STRIPE")) {
            return ResponseEntity.ok(ApiResponse.ok(new StripeWebhookResponse(event.getId(), "duplicate")));
        }

        String payloadHash = PaymentCallbackHasher.sha256(payload);
        String signatureHash = PaymentCallbackHasher.sha256(signatureHeader);
        var duplicate = callbackLogStore.findProcessed("STRIPE", event.getId(), payloadHash, signatureHash).orElse(null);
        if (duplicate != null) {
            callbackLogStore.save(attempt(event, payload, payloadHash, signatureHash, duplicate.processingStatus(), true));
            return ResponseEntity.ok(ApiResponse.ok(new StripeWebhookResponse(event.getId(), "duplicate")));
        }

        if (!"payment_intent.succeeded".equals(event.getType())) {
            // payment_intent.payment_failed and similar — ack with 200 so Stripe stops retrying,
            // but don't promote.
            callbackLogStore.save(attempt(event, payload, payloadHash, signatureHash, "IGNORED", false));
            webhookIdempotencyService.markProcessed(event.getId(), "STRIPE", event.getType());
            return ResponseEntity.ok(ApiResponse.ok(new StripeWebhookResponse(event.getId(), event.getType())));
        }

        PaymentIntent intent = StripeWebhookVerifier.paymentIntent(event);
        if (intent == null) {
            log.warn("stripe-webhook-deserialise-failed event={} type={}", event.getId(), event.getType());
            callbackLogStore.save(attempt(event, payload, payloadHash, signatureHash, "BAD_PAYLOAD", false));
            return ResponseEntity.badRequest().body(ApiResponse.error("payload mismatch", "BAD_PAYLOAD"));
        }
        Map<String, String> metadata = intent.getMetadata() == null ? Map.of() : intent.getMetadata();
        String paymentIdStr = metadata.get("paymentId");
        String orderId = metadata.get("orderId");
        String vndAmountValue = metadata.get("vndAmount");
        if (paymentIdStr == null || paymentIdStr.isBlank()) {
            log.warn("stripe-webhook-missing-payment-id intent={}", intent.getId());
            callbackLogStore.save(attempt(event, payload, payloadHash, signatureHash, "BAD_PAYLOAD", false));
            return ResponseEntity.badRequest().body(ApiResponse.error("missing paymentId metadata", "BAD_PAYLOAD"));
        }

        UUID paymentId;
        try {
            paymentId = UUID.fromString(paymentIdStr);
        } catch (IllegalArgumentException ex) {
            callbackLogStore.save(attempt(event, payload, payloadHash, signatureHash, "BAD_PAYLOAD", false));
            return ResponseEntity.badRequest().body(ApiResponse.error("invalid paymentId metadata", "BAD_PAYLOAD"));
        }

        BigDecimal vndAmount;
        try {
            vndAmount = new BigDecimal(vndAmountValue == null ? "" : vndAmountValue);
        } catch (NumberFormatException ex) {
            callbackLogStore.save(attempt(event, payload, payloadHash, signatureHash, "BAD_PAYLOAD", false));
            return ResponseEntity.badRequest().body(ApiResponse.error("invalid amount metadata", "BAD_PAYLOAD"));
        }
        if (orderId == null || orderId.isBlank() || intent.getAmount() == null || intent.getCurrency() == null) {
            callbackLogStore.save(attempt(event, payload, payloadHash, signatureHash, "BAD_PAYLOAD", false));
            return ResponseEntity.badRequest().body(ApiResponse.error("incomplete payment metadata", "BAD_PAYLOAD"));
        }

        PaymentCallbackAttempt savedAttempt;
        PaymentPromotionService.PromotionResult result;
        try {
            savedAttempt = callbackLogStore.save(
                    attempt(event, payload, payloadHash, signatureHash, "RECEIVED", false));
            result = promotionService.promote(
                    PaymentPromotionService.PromotionCommand.fromStripeCallback(
                            paymentId, intent.getId(),
                            savedAttempt.callbackId(), event.getId(), payloadHash,
                            orderId, vndAmount, intent.getAmount(), intent.getCurrency()));
        } catch (IllegalArgumentException ex) {
            log.warn("stripe-webhook-invalid-evidence event={} error={}", event.getId(), ex.getMessage());
            callbackLogStore.save(attempt(event, payload, payloadHash, signatureHash, "BAD_PAYLOAD", false));
            return ResponseEntity.badRequest().body(ApiResponse.error("payload does not match payment", "BAD_PAYLOAD"));
        } catch (Exception ex) {
            log.error("stripe-webhook-processing-failed event={} error={}", event.getId(), ex.getMessage());
            webhookIdempotencyService.storePendingForRetry(event.getId(), "STRIPE", event.getType(), payload);
            // Return 200 so Stripe does not keep retrying — we handle retry internally.
            return ResponseEntity.ok(ApiResponse.ok(new StripeWebhookResponse(event.getId(), "queued_for_retry")));
        }

        if (result.outcome() == PaymentPromotionService.PromotionResult.Outcome.PAYMENT_NOT_FOUND) {
            log.warn("stripe-webhook-payment-not-found paymentId={} intent={}", paymentId, intent.getId());
            webhookIdempotencyService.storePendingForRetry(event.getId(), "STRIPE", event.getType(), payload);
            return ResponseEntity.ok(ApiResponse.ok(new StripeWebhookResponse(event.getId(), "queued_for_retry")));
        }
        callbackLogStore.save(attempt(event, payload, payloadHash, signatureHash, "PROCESSED", false));
        webhookIdempotencyService.markProcessed(event.getId(), "STRIPE", event.getType());
        return ResponseEntity.ok(ApiResponse.ok(new StripeWebhookResponse(event.getId(), result.outcome().name())));
    }

    private PaymentCallbackAttempt attempt(Event event, String payload, String payloadHash, String signatureHash,
                                           String processingStatus, boolean duplicateReplay) {
        return new PaymentCallbackAttempt(
                UUID.randomUUID(),
                "STRIPE",
                event.getId(),
                payloadHash,
                signatureHash,
                "",
                payload,
                Instant.now(),
                processingStatus,
                duplicateReplay);
    }

    public record StripeWebhookResponse(String eventId, String outcome) {
    }
}
