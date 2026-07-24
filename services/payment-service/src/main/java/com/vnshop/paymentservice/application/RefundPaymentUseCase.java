package com.vnshop.paymentservice.application;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.PaymentRefundRecord;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.PaymentRefundRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.RefundGatewayPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Objects;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Application service: orchestrates the refund of a completed payment.
 *
 * <ol>
 *   <li>Locates the payment by {@code orderId}.</li>
 *   <li>Verifies the payment is in {@link PaymentStatus#COMPLETED} status.</li>
 *   <li>Selects the matching {@link RefundGatewayPort} adapter.</li>
 *   <li>Calls the gateway, marks the payment as {@link PaymentStatus#REFUNDED},
 *       and saves the updated record.</li>
 *   <li>Returns a {@link RefundResult} the caller can use to publish the
 *       {@code payment.refunded} event.</li>
 * </ol>
 *
 * <p>Event publishing is intentionally left to the infrastructure layer
 * (the Kafka listener that calls this use case) so the application layer
 * stays free of messaging infrastructure.
 */
public class RefundPaymentUseCase {

    private static final Logger log = LoggerFactory.getLogger(RefundPaymentUseCase.class);

    private final PaymentRepositoryPort paymentRepository;
    private final List<RefundGatewayPort> gateways;
    private final PaymentRefundRepositoryPort refundRepository;

    public RefundPaymentUseCase(PaymentRepositoryPort paymentRepository, List<RefundGatewayPort> gateways) {
        this(paymentRepository, gateways, null);
    }

    public RefundPaymentUseCase(PaymentRepositoryPort paymentRepository, List<RefundGatewayPort> gateways,
                                PaymentRefundRepositoryPort refundRepository) {
        this.paymentRepository = Objects.requireNonNull(paymentRepository, "paymentRepository is required");
        this.gateways = Objects.requireNonNull(gateways, "gateways is required");
        this.refundRepository = refundRepository;
    }

    /**
     * @throws OrderNotFoundException          when no payment exists for the order
     * @throws PaymentNotRefundableException   when the payment is not in COMPLETED status
     * @throws UnsupportedPaymentMethodException when no gateway adapter supports the payment method
     */
    public RefundResult refund(RefundPaymentCommand command) {
        Objects.requireNonNull(command, "command is required");

        Payment payment = paymentRepository.findByOrderIdForUpdate(command.orderId())
                .orElseThrow(() -> new OrderNotFoundException(command.orderId()));

        UUID reversalId = Objects.requireNonNull(command.reversalId(), "reversalId is required");
        if (refundRepository != null) {
            var existing = refundRepository.findByReversalId(reversalId);
            if (existing.isPresent()) {
                PaymentRefundRecord record = existing.get();
                return new RefundResult(payment, record.providerRef(), reversalId, record.amount());
            }
        }

        if (payment.status() != PaymentStatus.COMPLETED && payment.status() != PaymentStatus.PARTIALLY_REFUNDED) {
            throw new PaymentNotRefundableException(
                    "payment for orderId=" + command.orderId()
                            + " is not COMPLETED (status=" + payment.status() + ")");
        }

        String methodName = payment.method().name();
        RefundGatewayPort gateway = gateways.stream()
                .filter(g -> g.supports(methodName))
                .findFirst()
                .orElseThrow(() -> new UnsupportedPaymentMethodException(
                        "no refund gateway for payment method " + methodName));

        String transactionRef = payment.transactionRef();
        if (transactionRef == null || transactionRef.isBlank()) {
            throw new PaymentNotRefundableException(
                    "payment for orderId=" + command.orderId() + " has no gateway transaction reference stored");
        }

        BigDecimal requestedAmount = command.amount() == null ? payment.amount() : command.amount();
        if (requestedAmount.signum() <= 0) {
            throw new PaymentNotRefundableException("refund amount must be positive");
        }
        BigDecimal completedRefunds = refundRepository == null
                ? BigDecimal.ZERO
                : refundRepository.sumCompletedByPaymentId(payment.paymentId());
        BigDecimal remaining = payment.amount().subtract(completedRefunds);
        if (requestedAmount.compareTo(remaining) > 0) {
            throw new PaymentNotRefundableException("refund exceeds remaining captured amount");
        }

        String refundId = gateway.refund(
                payment.paymentId().toString(),
                transactionRef,
                requestedAmount,
                command.reason(),
                reversalId.toString());

        log.info("refund-issued orderId={} method={} transactionRef={} refundId={}",
                command.orderId(), methodName, transactionRef, refundId);

        BigDecimal cumulativeRefunds = completedRefunds.add(requestedAmount);
        PaymentStatus nextStatus = cumulativeRefunds.compareTo(payment.amount()) == 0
                ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
        Payment refunded = payment.withResult(nextStatus, transactionRef);
        paymentRepository.save(refunded);

        if (refundRepository != null) {
            Instant now = Instant.now();
            refundRepository.save(new PaymentRefundRecord(
                    reversalId, payment.paymentId(), refundId, requestedAmount, "VND",
                    PaymentRefundRecord.RefundStatus.COMPLETED, now, now));
        }

        return new RefundResult(refunded, refundId, reversalId, requestedAmount);
    }

    /**
     * Carries the updated {@link Payment} and the gateway-assigned refund id
     * back to the infrastructure layer for event publishing.
     */
    public record RefundResult(Payment payment, String refundId, UUID reversalId, BigDecimal amount) {
        public RefundResult(Payment payment, String refundId) {
            this(payment, refundId, UUID.nameUUIDFromBytes(refundId.getBytes(java.nio.charset.StandardCharsets.UTF_8)), payment.amount());
        }
    }
}
