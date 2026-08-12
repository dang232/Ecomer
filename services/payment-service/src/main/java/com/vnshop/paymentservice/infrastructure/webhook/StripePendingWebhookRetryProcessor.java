package com.vnshop.paymentservice.infrastructure.webhook;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackHasher;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class StripePendingWebhookRetryProcessor implements PendingWebhookRetryProcessor {
    private final PaymentPromotionService promotionService;
    private final PaymentCallbackLogStore callbackLogStore;
    private final ObjectMapper objectMapper;
    private final WebhookIdempotencyService idempotencyService;

    public StripePendingWebhookRetryProcessor(
            PaymentPromotionService promotionService,
            PaymentCallbackLogStore callbackLogStore,
            ObjectMapper objectMapper,
            WebhookIdempotencyService idempotencyService) {
        this.promotionService = promotionService;
        this.callbackLogStore = callbackLogStore;
        this.objectMapper = objectMapper;
        this.idempotencyService = idempotencyService;
    }

    @Override
    public void process(PendingWebhookRetryEvent retry) {
        if (!"STRIPE".equals(retry.provider()) || !"payment_intent.succeeded".equals(retry.eventType())) {
            throw new IllegalArgumentException("Unsupported webhook retry: " + retry.provider() + "/" + retry.eventType());
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(retry.payload());
        } catch (Exception exception) {
            throw new IllegalArgumentException("Stripe retry payload is malformed", exception);
        }
        String payloadEventId = root.path("id").asText("");
        String payloadEventType = root.path("type").asText("");
        String payloadObjectType = root.path("object").asText("");
        if (!retry.webhookId().equals(payloadEventId)
                || !retry.eventType().equals(payloadEventType)
                || !"event".equals(payloadObjectType)) {
            throw new IllegalArgumentException("Stripe retry payload identity does not match pending webhook");
        }
        JsonNode paymentIntent = root.path("data").path("object");
        if (!"payment_intent".equals(paymentIntent.path("object").asText(""))) {
            throw new IllegalArgumentException("Stripe retry payload is not a PaymentIntent event");
        }
        String intentId = paymentIntent.path("id").asText("");
        String paymentIdValue = paymentIntent.path("metadata").path("paymentId").asText("");
        String orderId = paymentIntent.path("metadata").path("orderId").asText("");
        String vndAmountValue = paymentIntent.path("metadata").path("vndAmount").asText("");
        long amountMinor = paymentIntent.path("amount").asLong(0L);
        String currency = paymentIntent.path("currency").asText("");
        if (intentId.isBlank() || paymentIdValue.isBlank() || orderId.isBlank()
                || amountMinor <= 0 || currency.isBlank()) {
            throw new IllegalArgumentException("Stripe retry payload has incomplete PaymentIntent metadata");
        }
        BigDecimal vndAmount;
        try {
            vndAmount = new BigDecimal(vndAmountValue);
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Stripe retry payload has invalid VND amount metadata", exception);
        }
        UUID paymentId = UUID.fromString(paymentIdValue);
        String payloadHash = PaymentCallbackHasher.sha256(retry.payload());
        PaymentCallbackAttempt attempt = callbackLogStore.save(new PaymentCallbackAttempt(
                UUID.randomUUID(), retry.provider(), retry.webhookId(), payloadHash, "", "",
                retry.payload(), Instant.now(), "RECEIVED", false));
        PaymentPromotionService.PromotionResult result = promotionService.promote(
                PaymentPromotionService.PromotionCommand.fromStripeCallback(
                        paymentId, intentId, attempt.callbackId(),
                        retry.webhookId(), payloadHash, orderId, vndAmount, amountMinor, currency));
        if (!result.isSuccess()) {
            throw new IllegalStateException("Payment promotion failed: " + result.outcome());
        }
        callbackLogStore.save(new PaymentCallbackAttempt(
                UUID.randomUUID(), retry.provider(), retry.webhookId(), payloadHash, "", "",
                retry.payload(), Instant.now(), "PROCESSED", false));
        idempotencyService.markProcessed(retry.webhookId(), retry.provider(), retry.eventType());
    }
}
