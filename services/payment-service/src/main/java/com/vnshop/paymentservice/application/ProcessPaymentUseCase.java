package com.vnshop.paymentservice.application;

import com.vnshop.paymentservice.domain.OrderSnapshot;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentIdempotencyKey;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.OrderCatalogPort;
import com.vnshop.paymentservice.domain.port.out.PaymentGatewayPort;
import com.vnshop.paymentservice.domain.port.out.PaymentIdempotencyKeyRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.PaymentMetricsPort;
import com.vnshop.paymentservice.application.ledger.LedgerService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;
import java.util.Optional;

public class ProcessPaymentUseCase {
    private static final Logger log = LoggerFactory.getLogger(ProcessPaymentUseCase.class);

    private final PaymentRepositoryPort paymentRepositoryPort;
    private final PaymentGatewayPort paymentGatewayPort;
    private final LedgerService ledgerService;
    private final PaymentIdempotencyKeyRepositoryPort idempotencyKeyRepository;
    private final OrderCatalogPort orderCatalogPort;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;
    private final PaymentMetricsPort metrics;

    public ProcessPaymentUseCase(
            PaymentRepositoryPort paymentRepositoryPort,
            PaymentGatewayPort paymentGatewayPort,
            LedgerService ledgerService,
            PaymentIdempotencyKeyRepositoryPort idempotencyKeyRepository,
            OrderCatalogPort orderCatalogPort,
            TransactionTemplate transactionTemplate
    ) {
        this(paymentRepositoryPort, paymentGatewayPort, ledgerService, idempotencyKeyRepository,
                orderCatalogPort, transactionTemplate, Clock.systemUTC());
    }

    public ProcessPaymentUseCase(
            PaymentRepositoryPort paymentRepositoryPort,
            PaymentGatewayPort paymentGatewayPort,
            LedgerService ledgerService,
            PaymentIdempotencyKeyRepositoryPort idempotencyKeyRepository,
            OrderCatalogPort orderCatalogPort,
            TransactionTemplate transactionTemplate,
            Clock clock
    ) {
        this(paymentRepositoryPort, paymentGatewayPort, ledgerService, idempotencyKeyRepository,
                orderCatalogPort, transactionTemplate, clock, null);
    }

    public ProcessPaymentUseCase(
            PaymentRepositoryPort paymentRepositoryPort, PaymentGatewayPort paymentGatewayPort,
            LedgerService ledgerService, PaymentIdempotencyKeyRepositoryPort idempotencyKeyRepository,
            OrderCatalogPort orderCatalogPort, TransactionTemplate transactionTemplate,
            Clock clock, PaymentMetricsPort metrics
    ) {
        this.paymentRepositoryPort = Objects.requireNonNull(paymentRepositoryPort, "paymentRepositoryPort is required");
        this.paymentGatewayPort = Objects.requireNonNull(paymentGatewayPort, "paymentGatewayPort is required");
        this.ledgerService = Objects.requireNonNull(ledgerService, "ledgerService is required");
        this.idempotencyKeyRepository = Objects.requireNonNull(idempotencyKeyRepository, "idempotencyKeyRepository is required");
        this.orderCatalogPort = Objects.requireNonNull(orderCatalogPort, "orderCatalogPort is required");
        this.transactionTemplate = Objects.requireNonNull(transactionTemplate, "transactionTemplate is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
        this.metrics = metrics;
    }

    /**
     * HTTP create-path entry point. Resolves the authoritative payable amount
     * from order-service and rejects any client whose JWT principal doesn't
     * match the order's buyer. Closes the price-tampering finding documented
     * in {@code docs/SESSION-HANDOVER-2026-05-20-pt12.md}.
     *
     * <p>For the trusted service-to-service gRPC path (where order-service
     * itself initiates a payment as part of order creation, before the order
     * row is even persisted) use {@link #processInternal(ProcessPaymentCommand,
     * BigDecimal)} instead.
     */
    public Payment process(ProcessPaymentCommand command) {
        OrderSnapshot order = orderCatalogPort.findByOrderId(command.orderId())
                .orElseThrow(() -> new OrderNotFoundException(command.orderId()));
        if (!order.buyerId().equals(command.buyerId())) {
            throw new OrderAccessDeniedException(
                    "buyer " + command.buyerId() + " does not own order " + command.orderId());
        }
        if (!order.isPayable()) {
            throw new OrderNotPayableException(
                    "order " + command.orderId() + " is not payable (status=" + order.paymentStatus() + ")");
        }
        return processWithAmount(new ProcessPaymentCommand(
                command.orderId(), command.buyerId(), command.method(), command.idempotencyKey(),
                order.currency(), command.idempotencyScope()), order.finalAmount()).payment();
    }

    /**
     * Trusted-caller entry point. Used by the gRPC server when order-service
     * itself initiates a payment as part of {@code CreateOrderUseCase} — the
     * order isn't persisted yet at that point so a back-lookup would 404, and
     * the caller IS the source of truth so a back-lookup would be redundant.
     * Skips the {@link OrderCatalogPort} round-trip.
     *
     * <p>Do NOT expose this to any HTTP-facing controller. The amount comes
     * straight from the caller — that's safe only when the caller is another
     * trusted service. The HTTP {@link #process(ProcessPaymentCommand)} path
     * resolves the amount server-side specifically because the HTTP caller is
     * the buyer's browser and cannot be trusted with it.
     */
    public Payment processInternal(ProcessPaymentCommand command, BigDecimal trustedAmount) {
        Objects.requireNonNull(trustedAmount, "trustedAmount is required");
        if (trustedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("amount must be positive");
        }
        return processWithAmount(command, trustedAmount).payment();
    }

    public PaymentProcessingResult processInternalResult(ProcessPaymentCommand command, BigDecimal trustedAmount) {
        Objects.requireNonNull(trustedAmount, "trustedAmount is required");
        if (trustedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("amount must be positive");
        }
        return processWithAmount(command, trustedAmount);
    }

    private PaymentProcessingResult processWithAmount(ProcessPaymentCommand command, BigDecimal authoritativeAmount) {
        String idempotencyKey = normalize(command.idempotencyKey());
        String requestHash = idempotencyKey == null ? null : computeRequestHash(command, authoritativeAmount);
        Payment pendingPayment = Payment.pending(command.orderId(), command.buyerId(), authoritativeAmount, toDomain(command.method()));

        if (idempotencyKey != null) {
            Optional<PaymentIdempotencyKey> existing = idempotencyKeyRepository.findByKey(idempotencyKey);
            if (existing.isPresent()) {
                PaymentIdempotencyKey stored = existing.get();
                if (!stored.requestHash().equals(requestHash)) {
                    throw new IdempotencyKeyConflictException(
                            "Idempotency-Key reused with a different request body"
                    );
                }
                Payment replayedPayment = paymentRepositoryPort.findById(stored.paymentId())
                         .orElseThrow(() -> new IllegalStateException(
                                 "Idempotency record references missing payment: " + stored.paymentId()
                         ));
                return new PaymentProcessingResult(replayedPayment, true, replayedPayment.createdAt());
            }
            if (idempotencyKeyRepository.supportsAtomicClaim()) {
                PaymentIdempotencyKey claim = new PaymentIdempotencyKey(
                        idempotencyKey, pendingPayment.paymentId(), requestHash, Instant.now(clock));
                if (!idempotencyKeyRepository.claim(claim)) {
                    PaymentIdempotencyKey raced = idempotencyKeyRepository.findByKey(idempotencyKey)
                            .orElseThrow(() -> new IllegalStateException("idempotency claim disappeared"));
                    if (!raced.requestHash().equals(requestHash)) {
                        throw new IdempotencyKeyConflictException("Idempotency-Key reused with a different request body");
                    }
                    Payment replayedPayment = paymentRepositoryPort.findById(raced.paymentId())
                            .orElseThrow(() -> new IdempotencyRequestInProgressException("idempotency claim is in progress"));
                    return new PaymentProcessingResult(replayedPayment, true, replayedPayment.createdAt());
                }
            }
        }

        // Gateway side-effect runs OUTSIDE the TX. A successful charge whose persistence later rolls
        // back is recoverable via reconciliation; a charge that's "rolled back" inside a TX boundary
        // is impossible — the bank already has the money.
        PaymentGatewayPort.GatewayPaymentResult result = paymentGatewayPort.processPayment(pendingPayment);

        try {
            String finalIdempotencyKey = idempotencyKey;
            String finalRequestHash = requestHash;
            return transactionTemplate.execute(status -> {
                Payment savedPayment = paymentRepositoryPort.save(
                        pendingPayment.withResult(result.status(), result.transactionRef())
                );
                if (savedPayment.status() == PaymentStatus.COMPLETED) {
                    ledgerService.recordPayment(savedPayment);
                }
                if (finalIdempotencyKey != null && idempotencyKeyRepository.supportsAtomicClaim()) {
                    idempotencyKeyRepository.markCompleted(finalIdempotencyKey);
                }
                if (finalIdempotencyKey != null && !idempotencyKeyRepository.supportsAtomicClaim()) {
                    idempotencyKeyRepository.save(new PaymentIdempotencyKey(
                            finalIdempotencyKey, savedPayment.paymentId(), finalRequestHash, Instant.now(clock)));
                }
                return new PaymentProcessingResult(savedPayment, false, Instant.now(clock));
            });
        } catch (RuntimeException ex) {
            if (metrics != null) metrics.recordOrphan();
            // Gateway already charged. Persistence failed. Surface the orphan loudly so the
            // reconciliation worker / on-call can recover. Caller still sees the failure and may
            // retry — the missing idempotency key means the retry attempts a fresh charge, which
            // is the correct UX trade-off only because this branch is rare and observable.
            log.error(
                    "payment-orphan: gateway charge succeeded but persistence failed. "
                            + "paymentId={} orderId={} buyerId={} gatewayTxnRef={} gatewayStatus={}",
                    pendingPayment.paymentId(),
                    command.orderId(),
                    command.buyerId(),
                    result.transactionRef(),
                    result.status(),
                    ex
            );
            throw ex;
        }
    }

    private static String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * Hash composition: SHA-256 over {@code orderId|buyerId|amount|currency|method|scope}.
     * The amount used is the BE-resolved authoritative amount, so legitimate
     * retries with the same JWT and same orderId always land on the same hash.
     */
    private static String computeRequestHash(ProcessPaymentCommand command, BigDecimal authoritativeAmount) {
        String canonical = String.join("|",
                String.valueOf(command.orderId()),
                String.valueOf(command.buyerId()),
                authoritativeAmount == null ? "null" : authoritativeAmount.stripTrailingZeros().toPlainString(),
                String.valueOf(command.currency()),
                command.method() == null ? "null" : command.method().name(),
                String.valueOf(command.idempotencyScope())
        );
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }

    private PaymentMethod toDomain(PaymentMethodInput method) {
        return switch (method) {
            case COD -> PaymentMethod.COD;
            case VNPAY -> PaymentMethod.VNPAY;
            case MOMO -> PaymentMethod.MOMO;
            case VIETQR -> PaymentMethod.VIETQR;
            case STRIPE -> PaymentMethod.STRIPE;
            case PAYPAL -> PaymentMethod.PAYPAL;
        };
    }
}
