package com.vnshop.paymentservice.application;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackHasher;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/** Promotes COD only after shipping has supplied verifiable collection evidence. */
@Service
public class ConfirmCodCollectionUseCase {
    private static final String COD_PROVIDER = "COD";
    private static final String VND = "VND";

    private final PaymentRepositoryPort paymentRepository;
    private final PaymentPromotionService promotionService;
    private final PaymentCallbackLogStore callbackLogStore;

    public ConfirmCodCollectionUseCase(
            PaymentRepositoryPort paymentRepository,
            PaymentPromotionService promotionService,
            PaymentCallbackLogStore callbackLogStore) {
        this.paymentRepository = Objects.requireNonNull(paymentRepository, "paymentRepository is required");
        this.promotionService = Objects.requireNonNull(promotionService, "promotionService is required");
        this.callbackLogStore = Objects.requireNonNull(callbackLogStore, "callbackLogStore is required");
    }

    @Transactional
    public Result confirm(Command command) {
        Objects.requireNonNull(command, "command is required");
        validateEvidence(command);

        Payment payment = paymentRepository.findByOrderIdForUpdate(command.orderId())
                .orElseThrow(() -> new IllegalArgumentException("payment not found for order: " + command.orderId()));
        if (payment.method() != com.vnshop.paymentservice.domain.PaymentMethod.COD) {
            throw new IllegalArgumentException("payment is not COD: " + command.orderId());
        }
        if (payment.amount().compareTo(command.amount()) != 0) {
            throw new IllegalArgumentException("collection amount does not match expected payment amount");
        }
        if (payment.status() == PaymentStatus.COMPLETED) {
            if (command.collectionId().toString().equals(payment.codCollectionEventId())) {
                return Result.alreadyConfirmed(payment);
            }
            throw new IllegalStateException("COD payment is already completed with another collection event");
        }
        if (payment.status() != PaymentStatus.AWAITING_COLLECTION) {
            throw new IllegalStateException("COD payment is not awaiting collection: " + payment.status());
        }

        Payment withCollection = payment.withCodCollection(
                command.collectionId().toString(), command.collectedAt());
        paymentRepository.save(withCollection);

        String payloadHash = PaymentCallbackHasher.sha256(command.canonical());
        PaymentCallbackAttempt callback = callbackLogStore.findProcessed(
                        COD_PROVIDER, command.collectionId().toString(), payloadHash, PaymentCallbackHasher.sha256(""))
                .orElseGet(() -> callbackLogStore.save(new PaymentCallbackAttempt(
                        command.collectionId(), COD_PROVIDER, command.collectionId().toString(), payloadHash,
                        PaymentCallbackHasher.sha256(""), "{}", command.canonical(),
                        command.collectedAt(), "PROCESSED", false)));

        PaymentPromotionService.PromotionResult promoted = promotionService.promote(
                PaymentPromotionService.PromotionCommand.fromCallback(
                        withCollection.paymentId(), COD_PROVIDER, "COD-" + command.collectionId(),
                        callback.callbackId(), callback.eventId(), callback.payloadHash()));
        return switch (promoted.outcome()) {
            case PROMOTED -> Result.promoted(promoted.payment());
            case ALREADY_COMPLETED -> Result.alreadyConfirmed(promoted.payment());
            case PAYMENT_NOT_FOUND -> throw new IllegalStateException(
                    "payment disappeared during COD collection promotion: " + withCollection.paymentId());
        };
    }

    private static void validateEvidence(Command command) {
        if (!VND.equalsIgnoreCase(command.currency())) {
            throw new IllegalArgumentException("COD collection currency must be VND");
        }
        if (command.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("COD collection amount must be positive");
        }
        if (command.orderId().isBlank() || command.carrier().isBlank()) {
            throw new IllegalArgumentException("order and carrier are required");
        }
    }

    public record Command(
            java.util.UUID collectionId,
            java.util.UUID shipmentId,
            String orderId,
            String carrier,
            BigDecimal amount,
            String currency,
            Instant collectedAt) {
        public Command {
            Objects.requireNonNull(collectionId, "collectionId is required");
            Objects.requireNonNull(shipmentId, "shipmentId is required");
            Objects.requireNonNull(orderId, "orderId is required");
            Objects.requireNonNull(carrier, "carrier is required");
            Objects.requireNonNull(amount, "amount is required");
            Objects.requireNonNull(currency, "currency is required");
            Objects.requireNonNull(collectedAt, "collectedAt is required");
        }

        String canonical() {
            return String.join("|", collectionId.toString(), shipmentId.toString(), orderId,
                    carrier, amount.stripTrailingZeros().toPlainString(), currency, collectedAt.toString());
        }
    }

    public record Result(Outcome outcome, Payment payment) {
        public enum Outcome { PROMOTED, ALREADY_CONFIRMED }

        private static Result promoted(Payment payment) { return new Result(Outcome.PROMOTED, payment); }
        private static Result alreadyConfirmed(Payment payment) { return new Result(Outcome.ALREADY_CONFIRMED, payment); }
    }
}
