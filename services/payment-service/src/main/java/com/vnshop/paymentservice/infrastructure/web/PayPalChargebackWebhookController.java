package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.application.chargeback.ChargebackService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.domain.Chargeback;
import com.vnshop.paymentservice.infrastructure.webhook.WebhookIdempotencyService;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalWebhookHeaders;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalWebhookVerifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.beans.factory.annotation.Value;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;

/**
 * Receives PayPal {@code CUSTOMER.DISPUTE.CREATED} webhook events and creates
 * a {@link Chargeback} record. PayPal authenticates via webhook ID verification
 * (header-based) through PayPal's Verify Webhook Signature API before any
 * idempotency or chargeback side effect is attempted.
 */
@RestController
@RequestMapping("/payment/paypal")
@ConditionalOnProperty(name = "payment.paypal.enabled", havingValue = "true")
public class PayPalChargebackWebhookController {

    private static final Logger log = LoggerFactory.getLogger(PayPalChargebackWebhookController.class);
    private static final String DISPUTE_CREATED = "CUSTOMER.DISPUTE.CREATED";

    @Value("${payment.paypal.webhook-id:}")
    private String paypalWebhookId;

    private final ChargebackService chargebackService;
    private final WebhookIdempotencyService webhookIdempotencyService;
    private final PayPalWebhookVerifier webhookVerifier;
    private final ObjectMapper objectMapper;

    public PayPalChargebackWebhookController(ChargebackService chargebackService,
                                              WebhookIdempotencyService webhookIdempotencyService,
                                              PayPalWebhookVerifier webhookVerifier,
                                              ObjectMapper objectMapper) {
        this.chargebackService = Objects.requireNonNull(chargebackService, "chargebackService is required");
        this.webhookIdempotencyService = Objects.requireNonNull(webhookIdempotencyService, "webhookIdempotencyService is required");
        this.webhookVerifier = Objects.requireNonNull(webhookVerifier, "webhookVerifier is required");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is required");
    }

    @PostMapping("/chargeback-webhook")
    public ResponseEntity<ApiResponse<ChargebackWebhookResponse>> chargebackWebhook(
            @RequestHeader(value = "PAYPAL-AUTH-ALGO", required = false) String authAlgo,
            @RequestHeader(value = "PAYPAL-CERT-URL", required = false) String certUrl,
            @RequestHeader(value = "PAYPAL-TRANSMISSION-ID", required = false) String transmissionId,
            @RequestHeader(value = "PAYPAL-TRANSMISSION-SIG", required = false) String transmissionSig,
            @RequestHeader(value = "PAYPAL-TRANSMISSION-TIME", required = false) String transmissionTime,
            @RequestBody String rawPayload) {
        // Fail closed: reject all webhooks if webhook-id is not configured
        if (paypalWebhookId == null || paypalWebhookId.isBlank()) {
            log.error("PayPal webhook-id not configured — rejecting all chargeback webhooks. Set payment.paypal.webhook-id property.");
            return ResponseEntity.status(503).body(ApiResponse.error("webhook verification unavailable", "CONFIG_ERROR"));
        }

        PayPalWebhookVerifier.PayPalWebhookVerificationResult verification = webhookVerifier.verify(
                new PayPalWebhookHeaders(authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime),
                paypalWebhookId, rawPayload);
        if (verification == PayPalWebhookVerifier.PayPalWebhookVerificationResult.UNAVAILABLE) {
            return ResponseEntity.status(503).body(ApiResponse.error("webhook verification unavailable", "SERVICE_UNAVAILABLE"));
        }
        if (verification != PayPalWebhookVerifier.PayPalWebhookVerificationResult.VERIFIED) {
            log.warn("paypal-chargeback-webhook-invalid-signature");
            return ResponseEntity.badRequest().body(ApiResponse.error("invalid webhook signature", "BAD_SIGNATURE"));
        }

        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(rawPayload, Map.class);
        } catch (JsonProcessingException ex) {
            return ResponseEntity.badRequest().body(ApiResponse.error("invalid webhook payload", "BAD_PAYLOAD"));
        }

        String eventType = payload.getOrDefault("event_type", "").toString();
        String eventId = Objects.toString(payload.get("id"), "");

        // Webhook-level dedup: same event delivered twice → 200 immediately.
        if (!eventId.isBlank() && webhookIdempotencyService.isAlreadyProcessed(eventId, "PAYPAL")) {
            return ResponseEntity.ok(ApiResponse.ok(new ChargebackWebhookResponse("duplicate")));
        }

        if (!DISPUTE_CREATED.equals(eventType)) {
            return ResponseEntity.ok(ApiResponse.ok(new ChargebackWebhookResponse("ignored")));
        }

        Map<?, ?> resource = payload.get("resource") instanceof Map<?, ?> m ? m : Map.of();
        String disputeId = Objects.toString(resource.get("dispute_id"), "UNKNOWN");
        String orderId = extractOrderId(resource);
        String reason = Objects.toString(resource.get("reason"), "unspecified");
        LocalDate dueDate = null;
        Map<?, ?> disputedTransaction = firstDisputedTransaction(resource);
        BigDecimal challengedAmount = parseAmount(disputedTransaction.get("amount"));
        String currency = Objects.toString(disputedTransaction.get("currency"), "VND");
        String providerPaymentId = Objects.toString(disputedTransaction.get("seller_transaction_id"), null);

        Chargeback result;
        try {
            result = chargebackService.createFromWebhook(
                    orderId,
                    disputeId,
                    Chargeback.ChargebackProvider.PAYPAL,
                    reason,
                    dueDate, challengedAmount, currency.toUpperCase(java.util.Locale.ROOT), providerPaymentId);
        } catch (Exception ex) {
            log.error("paypal-chargeback-webhook-processing-failed eventId={} error={}", eventId, ex.getMessage());
            if (!eventId.isBlank()) {
                webhookIdempotencyService.storePendingForRetry(
                        eventId, "PAYPAL", eventType,
                        payload.toString());
            }
            return ResponseEntity.ok(ApiResponse.ok(new ChargebackWebhookResponse("queued_for_retry")));
        }

        if (!eventId.isBlank()) {
            webhookIdempotencyService.markProcessed(eventId, "PAYPAL", eventType);
        }
        String outcome = result == null ? "duplicate" : result.id().toString();
        return ResponseEntity.ok(ApiResponse.ok(new ChargebackWebhookResponse(outcome)));
    }

    @SuppressWarnings("unchecked")
    private String extractOrderId(Map<?, ?> resource) {
        Object disputedTransactions = resource.get("disputed_transactions");
        if (disputedTransactions instanceof java.util.List<?> list && !list.isEmpty()
                && list.get(0) instanceof Map<?, ?> first) {
            Object invoiceNumber = first.get("invoice_number");
            if (invoiceNumber != null && !invoiceNumber.toString().isBlank()) {
                return invoiceNumber.toString();
            }
        }
        return "UNKNOWN";
    }

    private Map<?, ?> firstDisputedTransaction(Map<?, ?> resource) {
        Object value = resource.get("disputed_transactions");
        if (value instanceof java.util.List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
            return first;
        }
        return Map.of();
    }

    private BigDecimal parseAmount(Object raw) {
        if (raw instanceof Map<?, ?> map) raw = map.get("value");
        if (raw == null) return null;
        try { return new BigDecimal(raw.toString()); } catch (NumberFormatException ignored) { return null; }
    }

    public record ChargebackWebhookResponse(String outcome) {
    }
}
