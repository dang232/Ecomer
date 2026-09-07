package com.vnshop.paymentservice.infrastructure.gateway;

import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "payment.vnpay.enabled", havingValue = "true")
public class VnpayCallbackService {
    private static final Logger log = LoggerFactory.getLogger(VnpayCallbackService.class);
    private final PaymentRepositoryPort paymentRepositoryPort;
    private final VnpayGateway vnpayGateway;
    private final PaymentCallbackLogStore callbackLogStore;
    private final PaymentPromotionService promotionService;

    public VnpayCallbackService(PaymentRepositoryPort paymentRepositoryPort, VnpayGateway vnpayGateway,
                                PaymentCallbackLogStore callbackLogStore, PaymentPromotionService promotionService) {
        this.paymentRepositoryPort = Objects.requireNonNull(paymentRepositoryPort, "paymentRepositoryPort is required");
        this.vnpayGateway = Objects.requireNonNull(vnpayGateway, "vnpayGateway is required");
        this.callbackLogStore = Objects.requireNonNull(callbackLogStore, "callbackLogStore is required");
        this.promotionService = Objects.requireNonNull(promotionService, "promotionService is required");
    }

    @Transactional
    public VnpayIpnResult handleIpn(Map<String, String> parameters) {
        return handleIpn(parameters, Map.of());
    }

    @Transactional
    public VnpayIpnResult handleIpn(Map<String, String> parameters, Map<String, String> headers) {
        String body = PaymentCallbackHasher.canonical(parameters);
        String payloadHash = PaymentCallbackHasher.sha256(body);
        String signatureHash = PaymentCallbackHasher.sha256(parameters.get("vnp_SecureHash"));
        PaymentCallbackAttempt duplicate = callbackLogStore.findProcessed("VNPAY", parameters.get("vnp_TransactionNo"), payloadHash, signatureHash).orElse(null);
        if (duplicate != null) {
            callbackLogStore.save(attempt(parameters, headers, payloadHash, signatureHash, duplicate.processingStatus(), true));
            return VnpayIpnResult.success();
        }

        VnpayGateway.VnpayVerification verification = vnpayGateway.verify(parameters);
        if (!verification.validSignature()) {
            callbackLogStore.save(attempt(parameters, headers, payloadHash, signatureHash, "INVALID_SIGNATURE", false));
            return VnpayIpnResult.invalidSignature();
        }

        Payment payment = paymentRepositoryPort.findById(UUID.fromString(verification.paymentId())).orElse(null);
        if (payment == null) {
            callbackLogStore.save(attempt(parameters, headers, payloadHash, signatureHash, "PAYMENT_NOT_FOUND", false));
            return VnpayIpnResult.paymentNotFound();
        }

        PaymentStatus status = verification.status();
        String transactionRef = verification.transactionNo() == null || verification.transactionNo().isBlank()
                ? verification.paymentId()
                : verification.transactionNo();

        if (status != PaymentStatus.COMPLETED) {
            // Failed verification (response/transaction code non-zero). Persist the
            // FAILED transition without going through the promotion path — the
            // ledger should not be credited.
            paymentRepositoryPort.save(payment.withResult(PaymentStatus.FAILED, transactionRef));
            callbackLogStore.save(attempt(parameters, headers, payloadHash, signatureHash, "FAILED", false));
            return VnpayIpnResult.success();
        }

        if (verification.amount() == null || payment.amount().compareTo(verification.amount()) != 0) {
            log.warn("vnpay-callback-amount-mismatch txId={} paymentId={}", transactionRef, payment.paymentId());
            callbackLogStore.save(attempt(parameters, headers, payloadHash, signatureHash, "AMOUNT_MISMATCH", false));
            return VnpayIpnResult.success();
        }

        PaymentCallbackAttempt savedAttempt = callbackLogStore.save(
                attempt(parameters, headers, payloadHash, signatureHash, "PROCESSED", false));
        promotionService.promote(PaymentPromotionService.PromotionCommand.fromCallback(
                payment.paymentId(), "VNPAY", transactionRef,
                savedAttempt.callbackId(), savedAttempt.eventId(), savedAttempt.payloadHash(), verification.amount()));
        return VnpayIpnResult.success();
    }

    private PaymentCallbackAttempt attempt(Map<String, String> parameters, Map<String, String> headers, String payloadHash, String signatureHash, String processingStatus, boolean duplicateReplay) {
        return new PaymentCallbackAttempt(
                UUID.randomUUID(),
                "VNPAY",
                parameters.get("vnp_TransactionNo"),
                payloadHash,
                signatureHash,
                PaymentCallbackHasher.canonical(headers),
                PaymentCallbackHasher.canonical(parameters),
                Instant.now(),
                processingStatus,
                duplicateReplay
        );
    }

    public VnpayGateway.VnpayVerification verifyReturn(Map<String, String> parameters) {
        return vnpayGateway.verify(parameters);
    }

    public record VnpayIpnResult(String responseCode, String message) {
        static VnpayIpnResult success() {
            return new VnpayIpnResult("00", "Confirm Success");
        }

        static VnpayIpnResult invalidSignature() {
            return new VnpayIpnResult("97", "Invalid Checksum");
        }

        static VnpayIpnResult paymentNotFound() {
            return new VnpayIpnResult("01", "Order not Found");
        }
    }
}
