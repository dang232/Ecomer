package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.infrastructure.sepay.SepayProperties;
import com.vnshop.paymentservice.infrastructure.sepay.SepayWebhookPayload;
import com.vnshop.paymentservice.infrastructure.sepay.SepayTransactionValidator;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackHasher;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
import com.vnshop.paymentservice.infrastructure.web.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Handles push-mode callbacks from SePay for VietQR payments.
 *
 * <p>SePay can be configured in two modes:
 * <ol>
 *   <li><b>Push (webhook)</b> — SePay POSTs each new bank credit to this endpoint
 *       immediately. Preferred for low latency. Requires a publicly accessible URL
 *       (ngrok for local dev). Configure in the SePay dashboard under
 *       "Webhook URL" → {@code https://&lt;host&gt;/payment/sepay/webhook}.
 *   <li><b>Poll</b> — {@link SepayPoller} queries the SePay API on a fixed interval.
 *       Fallback when push is not reachable.
 * </ol>
 *
 * <p>Both modes share the same {@link PaymentPromotionService} promotion path and the
 * same {@link PaymentCallbackLogStore} idempotency store, so a credit processed by
 * either path is a no-op when the other path encounters it later.
 *
 * <h2>Signature verification</h2>
 * SePay authenticates callbacks with {@code Authorization: Apikey <webhookSecret>}.
 * The secret is configured via {@code payment.sepay.webhookSecret} (env var:
 * {@code SEPAY_WEBHOOK_SECRET}). Requests with a missing or wrong token are rejected
 * with HTTP 401 before any business logic runs. Comparison uses
 * {@link MessageDigest#isEqual} (constant-time) to resist timing attacks.
 *
 * <h2>Idempotency</h2>
 * {@link PaymentCallbackLogStore#findProcessed} deduplicates on
 * (provider="SEPAY", eventId=txId, payloadHash, signatureHash). A duplicate delivery
 * returns 200 without re-processing.
 */
@RestController
@RequestMapping("/payment/sepay")
@ConditionalOnProperty(name = "payment.sepay.enabled", havingValue = "true")
public class SepayWebhookController {

    private static final Logger log = LoggerFactory.getLogger(SepayWebhookController.class);
    private static final Pattern UUID_PATTERN = Pattern.compile(
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            Pattern.CASE_INSENSITIVE);

    private final SepayProperties properties;
    private final PaymentRepositoryPort paymentRepository;
    private final PaymentCallbackLogStore callbackLogStore;
    private final PaymentPromotionService promotionService;
    private final SepayTransactionValidator transactionValidator;

    public SepayWebhookController(
            SepayProperties properties,
            PaymentRepositoryPort paymentRepository,
            PaymentCallbackLogStore callbackLogStore,
            PaymentPromotionService promotionService) {
        this.properties = properties;
        this.paymentRepository = paymentRepository;
        this.callbackLogStore = callbackLogStore;
        this.promotionService = promotionService;
        this.transactionValidator = new SepayTransactionValidator(properties);
    }

    /**
     * SePay webhook endpoint. SePay POSTs a JSON body for each confirmed bank credit.
     *
     * <p>Expected body fields (subset used here):
     * <ul>
     *   <li>{@code id} — SePay transaction id (string or number)
     *   <li>{@code transaction_content} — bank transfer memo (contains the payment UUID)
     *   <li>{@code transferAmount} — credited amount
     * </ul>
     */
    @PostMapping("/webhook")
    public ApiResponse<String> handleWebhook(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody SepayWebhookPayload payload) {

        if (payload == null) {
            throw new IllegalArgumentException("SePay payload is required");
        }

        // --- 1. Signature verification ---
        if (!verifySignature(authHeader)) {
            log.warn("sepay-webhook-rejected reason=invalid_signature");
            throw new SepaySignatureException("Invalid or missing SePay webhook signature");
        }

        String txId = payload.id() != null ? payload.id() : "";
        String memo = payload.transactionContent() != null ? payload.transactionContent() : "";
        String bodyJson = payload.toCanonical();
        String payloadHash = PaymentCallbackHasher.sha256(bodyJson);
        String signatureHash = PaymentCallbackHasher.sha256(authHeader != null ? authHeader : "");

        // --- 2. Idempotency check ---
        Optional<PaymentCallbackAttempt> duplicate =
                callbackLogStore.findProcessed("SEPAY", txId, payloadHash, signatureHash);
        if (duplicate.isPresent()) {
            log.debug("sepay-webhook-duplicate txId={}", txId);
            return ApiResponse.ok("already_processed");
        }

        // --- 3. Extract payment UUID from memo ---
        Matcher matcher = UUID_PATTERN.matcher(memo);
        if (!matcher.find()) {
            log.info("sepay-webhook-skip-no-uuid txId={} memo={}", txId, memo);
            callbackLogStore.save(attempt(txId, payloadHash, signatureHash, bodyJson, "NO_UUID_IN_MEMO", false));
            return ApiResponse.ok("no_payment_ref");
        }

        UUID paymentId;
        try {
            paymentId = UUID.fromString(matcher.group());
        } catch (IllegalArgumentException ex) {
            log.warn("sepay-webhook-bad-uuid txId={} match={}", txId, matcher.group());
            callbackLogStore.save(attempt(txId, payloadHash, signatureHash, bodyJson, "BAD_UUID", false));
            return ApiResponse.ok("bad_payment_ref");
        }

        // --- 4. Lookup & validate payment ---
        Payment payment = paymentRepository.findById(paymentId).orElse(null);
        if (payment == null) {
            log.info("sepay-webhook-unknown-payment txId={} paymentId={}", txId, paymentId);
            callbackLogStore.save(attempt(txId, payloadHash, signatureHash, bodyJson, "PAYMENT_NOT_FOUND", false));
            return ApiResponse.ok("payment_not_found");
        }
        if (payment.method() != PaymentMethod.VIETQR) {
            log.info("sepay-webhook-non-vietqr txId={} paymentId={} method={}", txId, paymentId, payment.method());
            callbackLogStore.save(attempt(txId, payloadHash, signatureHash, bodyJson, "NON_VIETQR", false));
            return ApiResponse.ok("non_vietqr_payment");
        }
        if (payment.status() != PaymentStatus.PENDING) {
            log.debug("sepay-webhook-non-pending txId={} paymentId={} status={}", txId, paymentId, payment.status());
            callbackLogStore.save(attempt(txId, payloadHash, signatureHash, bodyJson, "NON_PENDING", false));
            return ApiResponse.ok("already_processed");
        }
        SepayTransactionValidator.Validation validation = transactionValidator.validate(
                payment, txId, payload.transferAmount() == null ? null : payload.transferAmount().toPlainString(),
                memo, payload.accountNumber(), payload.currency(), payload.transferType());
        if (!validation.accepted()) {
            log.warn("sepay-webhook-rejected txId={} paymentId={} reason={}", txId, paymentId, validation.reason());
            String status = validation.held() ? "OVERPAYMENT_HOLD" : "REJECTED_" + validation.reason();
            callbackLogStore.save(attempt(txId, payloadHash, signatureHash, bodyJson, status, false));
            return ApiResponse.ok(validation.held() ? "held_for_reconciliation" : "rejected");
        }

        // --- 5. Record receipt, then promote via shared promotion service ---
        PaymentCallbackAttempt receivedAttempt = attempt(txId, payloadHash, signatureHash, bodyJson, "RECEIVED", false);
        if (!callbackLogStore.claim(receivedAttempt)) {
            return ApiResponse.ok("already_processed");
        }
        PaymentPromotionService.PromotionResult promotion = promotionService.promote(
                PaymentPromotionService.PromotionCommand.fromCallback(
                paymentId, "SEPAY", "SEPAY:" + txId,
                receivedAttempt.callbackId(), receivedAttempt.eventId(), receivedAttempt.payloadHash()));
        if (!promotion.isSuccess()) {
            log.warn("sepay-webhook-promotion-not-completed txId={} paymentId={} outcome={}", txId, paymentId, promotion.outcome());
            return ApiResponse.ok("not_processed");
        }
        log.info("sepay-webhook-promoted txId={} paymentId={}", txId, paymentId);
        return ApiResponse.ok("processed");
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Verifies the {@code Authorization: Apikey <secret>} header SePay sends.
     * Rejects all callbacks when {@code webhookSecret} is not configured (fail closed).
     * Uses constant-time comparison to resist timing attacks.
     */
    private boolean verifySignature(String authHeader) {
        String secret = properties.webhookSecret();
        if (secret == null || secret.isBlank()) {
            // Fail closed: reject all webhooks when secret is not configured
            log.error("SePay webhook secret not configured — rejecting callback for security. Set payment.sepay.webhook-secret property.");
            return false;
        }
        if (authHeader == null || authHeader.isBlank()) {
            return false;
        }
        // SePay sends: "Apikey <secret>"
        String expected = "Apikey " + secret;
        return java.security.MessageDigest.isEqual(
                expected.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                authHeader.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private PaymentCallbackAttempt attempt(String txId, String payloadHash, String signatureHash,
                                           String bodyJson, String status, boolean duplicate) {
        return new PaymentCallbackAttempt(
                UUID.randomUUID(),
                "SEPAY",
                txId,
                payloadHash,
                signatureHash,
                "{}",
                bodyJson,
                Instant.now(),
                status,
                duplicate);
    }

    /** Thrown when the SePay webhook signature is invalid; mapped to HTTP 401 by the exception handler. */
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public static class SepaySignatureException extends RuntimeException {
        public SepaySignatureException(String message) {
            super(message);
        }
    }
}
