package com.vnshop.paymentservice.application;

import com.vnshop.paymentservice.application.ledger.LedgerService;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentCallbackOutboxRecord;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentCallbackOutbox;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Single PENDING → COMPLETED promotion path used by every adapter that confirms
 * a payment after the fact: {@code AdminVietQrController}, {@code VnpayCallbackService},
 * the future Stripe webhook, the PayPal capture endpoint, and the SePay poller.
 *
 * <p>Each adapter owns its own dedup story (signature verification, replay detection
 * via {@code PaymentCallbackLogStore}) — by the time the adapter calls into this
 * service the dedup decision has already been made. What this service guarantees is:
 *
 * <ol>
 *   <li>Re-running with the same payment id is a no-op when the payment is already
 *       COMPLETED. The stored row is returned unchanged.</li>
 *   <li>The save + ledger + outbox emit happen inside one transaction, so a crash
 *       between them never leaves the ledger and the payment row out of sync.</li>
 * </ol>
 *
 * <p>Outbox emit is optional — the caller may pass {@code null} for the dedup keys
 * to skip it (the manual admin path doesn't need an outbox row because no IPN was
 * received). When present, the outbox row is written to the same Kafka pipeline the
 * VNPay/MoMo flows already use.
 */
@Service
public class PaymentPromotionService {
    private static final Logger log = LoggerFactory.getLogger(PaymentPromotionService.class);

    private final PaymentRepositoryPort paymentRepository;
    private final LedgerService ledgerService;
    private final PaymentCallbackOutbox outbox;

    public PaymentPromotionService(
            PaymentRepositoryPort paymentRepository,
            LedgerService ledgerService,
            PaymentCallbackOutbox outbox) {
        this.paymentRepository = Objects.requireNonNull(paymentRepository, "paymentRepository is required");
        this.ledgerService = Objects.requireNonNull(ledgerService, "ledgerService is required");
        this.outbox = Objects.requireNonNull(outbox, "outbox is required");
    }

    @Transactional
    public PromotionResult promote(PromotionCommand command) {
        Optional<Payment> existing = paymentRepository.findByIdForUpdate(command.paymentId());
        if (existing.isEmpty()) {
            return PromotionResult.notFound();
        }
        Payment payment = existing.get();
        command.validate(payment);
        if (payment.status() == PaymentStatus.COMPLETED) {
            return PromotionResult.alreadyCompleted(payment);
        }

        Payment saved = paymentRepository.save(payment.withResult(PaymentStatus.COMPLETED, command.providerRef()));
        ledgerService.recordPayment(saved);
        if (command.outboxAttempt() != null) {
            OutboxAttempt attempt = command.outboxAttempt();
            outbox.save(PaymentCallbackOutboxRecord.pending(
                    command.provider(),
                    saved.paymentId(),
                    saved.orderId(),
                    command.providerRef(),
                    PaymentStatus.COMPLETED.name(),
                    saved.amount(),
                    attempt.callbackId(),
                    attempt.eventId(),
                    attempt.payloadHash(),
                    saved.externalAmount(), saved.externalCurrency(), saved.fxRate(), saved.fxRateAt()));
        }
        log.info("payment-promoted provider={} paymentId={} orderId={} providerRef={}",
                command.provider(), saved.paymentId(), saved.orderId(), command.providerRef());
        return PromotionResult.promoted(saved);
    }

    /**
     * Inputs to the success path. {@code outboxAttempt} is optional — pass {@code null}
     * when the caller doesn't have an inbound IPN to publish (e.g. the manual admin
     * confirm path).
     */
    public record PromotionCommand(
            UUID paymentId,
            String provider,
            String providerRef,
            OutboxAttempt outboxAttempt,
            StripeEvidence stripeEvidence) {
        public PromotionCommand {
            Objects.requireNonNull(paymentId, "paymentId is required");
            requireNonBlank(provider, "provider");
            requireNonBlank(providerRef, "providerRef");
        }

        public static PromotionCommand manual(UUID paymentId, String provider, String providerRef) {
            return new PromotionCommand(paymentId, provider, providerRef, null, null);
        }

        public static PromotionCommand fromCallback(UUID paymentId, String provider, String providerRef,
                                                     UUID callbackId, String eventId, String payloadHash) {
            return new PromotionCommand(paymentId, provider, providerRef,
                    new OutboxAttempt(callbackId, eventId, payloadHash), null);
        }

        public static PromotionCommand fromStripeCallback(
                UUID paymentId,
                String providerRef,
                UUID callbackId,
                String eventId,
                String payloadHash,
                String orderId,
                BigDecimal vndAmount,
                Long amountMinor,
                String currency) {
            return new PromotionCommand(
                    paymentId,
                    "STRIPE",
                    providerRef,
                    new OutboxAttempt(callbackId, eventId, payloadHash),
                    new StripeEvidence(orderId, vndAmount, amountMinor, currency));
        }

        private void validate(Payment payment) {
            if (stripeEvidence == null) {
                return;
            }
            if (!"STRIPE".equalsIgnoreCase(provider)
                    || payment.transactionRef() == null
                    || (!payment.transactionRef().equals(providerRef)
                    && !legacyStripePlaceholder(payment))) {
                throw new IllegalArgumentException("Stripe provider reference does not match payment");
            }
            if (payment.method() != com.vnshop.paymentservice.domain.PaymentMethod.STRIPE) {
                throw new IllegalArgumentException("Stripe evidence does not match payment method");
            }
            if (!payment.orderId().equals(stripeEvidence.orderId())) {
                throw new IllegalArgumentException("Stripe evidence does not match order");
            }
            if (payment.amount().compareTo(stripeEvidence.vndAmount()) != 0) {
                throw new IllegalArgumentException("Stripe evidence does not match VND amount");
            }
            if (!"USD".equalsIgnoreCase(stripeEvidence.currency())) {
                throw new IllegalArgumentException("Stripe evidence currency must be USD");
            }
            if (payment.externalAmount() == null || payment.fxRate() == null
                    || !"USD".equalsIgnoreCase(payment.externalCurrency())) {
                throw new IllegalArgumentException("Stripe payment has no frozen USD amount");
            }
            BigDecimal expectedMinor = payment.externalAmount()
                    .movePointRight(2)
                    .setScale(0, RoundingMode.UNNECESSARY);
            if (expectedMinor.compareTo(BigDecimal.valueOf(stripeEvidence.amountMinor())) != 0) {
                throw new IllegalArgumentException("Stripe evidence does not match USD amount");
            }
        }

        private boolean legacyStripePlaceholder(Payment payment) {
            return ("STRIPE-" + payment.paymentId()).equals(payment.transactionRef())
                    && providerRef.startsWith("pi_");
        }
    }

    public record StripeEvidence(String orderId, BigDecimal vndAmount, Long amountMinor, String currency) {
        public StripeEvidence {
            requireNonBlank(orderId, "orderId");
            Objects.requireNonNull(vndAmount, "vndAmount is required");
            Objects.requireNonNull(amountMinor, "amountMinor is required");
            requireNonBlank(currency, "currency");
            if (vndAmount.signum() <= 0 || amountMinor <= 0) {
                throw new IllegalArgumentException("Stripe amounts must be positive");
            }
        }
    }

    public record OutboxAttempt(UUID callbackId, String eventId, String payloadHash) {
        public OutboxAttempt {
            Objects.requireNonNull(callbackId, "callbackId is required");
        }
    }

    public record PromotionResult(Outcome outcome, Payment payment) {
        public enum Outcome { PROMOTED, ALREADY_COMPLETED, PAYMENT_NOT_FOUND }

        static PromotionResult promoted(Payment payment) {
            return new PromotionResult(Outcome.PROMOTED, payment);
        }

        static PromotionResult alreadyCompleted(Payment payment) {
            return new PromotionResult(Outcome.ALREADY_COMPLETED, payment);
        }

        static PromotionResult notFound() {
            return new PromotionResult(Outcome.PAYMENT_NOT_FOUND, null);
        }

        public boolean isSuccess() {
            return outcome == Outcome.PROMOTED || outcome == Outcome.ALREADY_COMPLETED;
        }
    }

    private static void requireNonBlank(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " is required");
        }
    }
}
