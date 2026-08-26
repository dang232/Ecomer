package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.application.OrderAccessDeniedException;
import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.infrastructure.config.JwtPrincipalUtil;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackEventStore;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackHasher;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalGateway;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

final class PayPalCaptureHandler {
    private final Optional<PayPalGateway> gateway;
    private final PaymentPromotionService promotionService;
    private final PaymentRepositoryPort paymentRepository;
    private final PaymentCallbackLogStore callbackLogStore;
    private final PaymentCallbackEventStore callbackEventStore;

    PayPalCaptureHandler(Optional<PayPalGateway> gateway, PaymentPromotionService promotionService,
            PaymentRepositoryPort paymentRepository, PaymentCallbackLogStore callbackLogStore,
            PaymentCallbackEventStore callbackEventStore) {
        this.gateway = gateway;
        this.promotionService = promotionService;
        this.paymentRepository = paymentRepository;
        this.callbackLogStore = callbackLogStore;
        this.callbackEventStore = callbackEventStore;
    }

    ApiResponse<PaymentResponse> capture(String paymentId, String paypalOrderId) {
        PayPalGateway paypal = gateway.orElseThrow(() ->
                new IllegalStateException("PayPal is not enabled — set payment.paypal.enabled=true"));
        UUID id = UUID.fromString(paymentId);
        String caller = JwtPrincipalUtil.currentUserId();
        Payment existing = paymentRepository.findById(id).orElseThrow(() ->
                new OrderAccessDeniedException("not authorized to capture this payment"));
        if (existing.method() != PaymentMethod.PAYPAL || !existing.buyerId().equals(caller)) {
            throw new OrderAccessDeniedException("not authorized to capture this payment");
        }
        if (existing.transactionRef() == null || !existing.transactionRef().equals(paypalOrderId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PayPal order ID mismatch");
        }
        if (existing.status() == PaymentStatus.COMPLETED) {
            return ApiResponse.ok(PaymentResponse.fromDomain(existing));
        }
        String payloadHash = PaymentCallbackHasher.sha256(paypalOrderId);
        String captureRequestKey = "capture:" + id;
        PayPalGateway.PayPalCapture capture = paypal.capture(paypalOrderId, captureRequestKey);
        callbackEventStore.append("PAYPAL", id, "PAYPAL:" + id + ":" + captureRequestKey, "RECEIVED");
        PaymentCallbackAttempt savedAttempt = callbackLogStore.save(
                attempt(paypalOrderId, payloadHash, "RECEIVED", false));
        PaymentPromotionService.PromotionResult result = promotionService.promote(
                PaymentPromotionService.PromotionCommand.fromCallback(id, "PAYPAL", capture.captureId(),
                        savedAttempt.callbackId(), capture.captureId(), payloadHash));
        callbackLogStore.save(attempt(paypalOrderId, payloadHash, "PROCESSED", false));
        callbackEventStore.append("PAYPAL", id, "PAYPAL:" + id + ":" + captureRequestKey, "PROCESSED");
        return ApiResponse.ok(PaymentResponse.fromDomain(result.payment()));
    }

    private PaymentCallbackAttempt attempt(String paypalOrderId, String payloadHash,
            String processingStatus, boolean duplicateReplay) {
        return new PaymentCallbackAttempt(UUID.randomUUID(), "PAYPAL", paypalOrderId, payloadHash, "", "",
                paypalOrderId, Instant.now(), processingStatus, duplicateReplay);
    }
}
