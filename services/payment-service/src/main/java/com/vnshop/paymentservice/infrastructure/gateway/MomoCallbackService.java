package com.vnshop.paymentservice.infrastructure.gateway;

import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.PaymentCallbackOutboxRecord;
import com.vnshop.paymentservice.domain.port.out.PaymentCallbackOutbox;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "payment.momo.enabled", havingValue = "true")
public class MomoCallbackService {
    private final PaymentRepositoryPort paymentRepositoryPort;
    private final MomoGateway momoGateway;
    private final PaymentCallbackLogStore callbackLogStore;
    private final PaymentCallbackOutbox outbox;
    private final PaymentPromotionService promotionService;

    public MomoCallbackService(PaymentRepositoryPort paymentRepositoryPort, MomoGateway momoGateway,
                               PaymentCallbackLogStore callbackLogStore, PaymentCallbackOutbox outbox,
                               PaymentPromotionService promotionService) {
        this.paymentRepositoryPort = Objects.requireNonNull(paymentRepositoryPort, "paymentRepositoryPort is required");
        this.momoGateway = Objects.requireNonNull(momoGateway, "momoGateway is required");
        this.callbackLogStore = Objects.requireNonNull(callbackLogStore, "callbackLogStore is required");
        this.outbox = Objects.requireNonNull(outbox, "outbox is required");
        this.promotionService = Objects.requireNonNull(promotionService, "promotionService is required");
    }

    @Transactional
    public MomoIpnResult handleIpn(MomoIpnRequest request) {
        return handleIpn(request, Map.of());
    }

    @Transactional
    public MomoIpnResult handleIpn(MomoIpnRequest request, Map<String, String> headers) {
        String body = PaymentCallbackHasher.canonical(MomoSigner.orderedIpnParameters(request));
        String payloadHash = PaymentCallbackHasher.sha256(body);
        String signatureHash = PaymentCallbackHasher.sha256(request.signature());
        PaymentCallbackAttempt duplicate = callbackLogStore.findProcessed("MOMO", String.valueOf(request.transId()), payloadHash, signatureHash).orElse(null);
        if (duplicate != null) {
            callbackLogStore.save(attempt(request, headers, payloadHash, signatureHash, duplicate.processingStatus(), true));
            return MomoIpnResult.success();
        }

        MomoGateway.MomoVerification verification = momoGateway.verifyIpn(request);
        if (!verification.validSignature()) {
            callbackLogStore.save(attempt(request, headers, payloadHash, signatureHash, "INVALID_SIGNATURE", false));
            return MomoIpnResult.invalidSignature();
        }

        Payment payment = paymentRepositoryPort.findById(UUID.fromString(verification.paymentId())).orElse(null);
        if (payment == null) {
            callbackLogStore.save(attempt(request, headers, payloadHash, signatureHash, "PAYMENT_NOT_FOUND", false));
            return MomoIpnResult.paymentNotFound();
        }
        if (payment.method() != PaymentMethod.MOMO) {
            callbackLogStore.save(attempt(request, headers, payloadHash, signatureHash, "PAYMENT_NOT_FOUND", false));
            return MomoIpnResult.paymentNotFound();
        }
        if (payment.status() == PaymentStatus.COMPLETED) {
            callbackLogStore.save(attempt(request, headers, payloadHash, signatureHash, "PROCESSED", false));
            return MomoIpnResult.success();
        }

        if (verification.status() != PaymentStatus.COMPLETED) {
            // FAILED IPN — persist the terminal status and an outbox row so
            // downstream consumers see the failure, but do not credit the
            // ledger. PaymentPromotionService only handles the success path.
            Payment failed = payment.withResult(verification.status(), verification.transactionNo());
            paymentRepositoryPort.save(failed);
            PaymentCallbackAttempt savedAttempt = callbackLogStore.save(
                    attempt(request, headers, payloadHash, signatureHash, "FAILED", false));
            outbox.save(PaymentCallbackOutboxRecord.pending(
                    "MOMO", payment.paymentId(), payment.orderId(),
                    verification.transactionNo(), verification.status().name(), payment.amount(),
                    savedAttempt.callbackId(), savedAttempt.eventId(), savedAttempt.payloadHash(),
                    null, null, null, null));
            return MomoIpnResult.success();
        }

        PaymentCallbackAttempt savedAttempt = callbackLogStore.save(
                attempt(request, headers, payloadHash, signatureHash, "PROCESSED", false));
        promotionService.promote(PaymentPromotionService.PromotionCommand.fromCallback(
                payment.paymentId(), "MOMO", verification.transactionNo(),
                savedAttempt.callbackId(), savedAttempt.eventId(), savedAttempt.payloadHash()));
        return MomoIpnResult.success();
    }

    private PaymentCallbackAttempt attempt(MomoIpnRequest request, Map<String, String> headers, String payloadHash, String signatureHash, String processingStatus, boolean duplicateReplay) {
        return new PaymentCallbackAttempt(
                UUID.randomUUID(),
                "MOMO",
                String.valueOf(request.transId()),
                payloadHash,
                signatureHash,
                PaymentCallbackHasher.canonical(headers),
                PaymentCallbackHasher.canonical(MomoSigner.orderedIpnParameters(request)),
                Instant.now(),
                processingStatus,
                duplicateReplay
        );
    }

    public record MomoIpnResult(int resultCode, String message) {
        static MomoIpnResult success() {
            return new MomoIpnResult(0, "Confirm Success");
        }

        static MomoIpnResult invalidSignature() {
            return new MomoIpnResult(97, "Invalid Signature");
        }

        static MomoIpnResult paymentNotFound() {
            return new MomoIpnResult(1, "Order not Found");
        }
    }
}
