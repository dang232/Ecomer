package com.vnshop.paymentservice.application;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.port.out.FxRatePort;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.support.TransactionOperations;

/**
 * Owns the immutable foreign-currency snapshot used by redirect/card providers.
 * Provider calls intentionally happen after this service returns, outside the
 * short database transaction, so retries retain exactly the same money shape.
 */
public class ProviderInitializationService {
    private final PaymentRepositoryPort payments;
    private final FxRatePort fxRates;
    private final TransactionOperations transactions;

    public ProviderInitializationService(
            PaymentRepositoryPort payments,
            FxRatePort fxRates,
            TransactionOperations transactions) {
        this.payments = Objects.requireNonNull(payments, "payments is required");
        this.fxRates = Objects.requireNonNull(fxRates, "fxRates is required");
        this.transactions = Objects.requireNonNull(transactions, "transactions is required");
    }

    public Payment freezeExternalAmount(UUID paymentId) {
        Payment candidate = payments.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("payment not found"));
        if (!requiresExternalCurrency(candidate.method())) {
            return candidate;
        }

        BigDecimal candidateRate = fxRates.rate("VND", "USD");
        return transactions.execute(status -> {
            Payment locked = payments.findByIdForUpdate(paymentId)
                    .orElseThrow(() -> new IllegalArgumentException("payment not found"));
            if (hasCompleteSnapshot(locked)) {
                return locked;
            }
            if (hasAnySnapshotValue(locked)) {
                throw new IllegalStateException("payment has an incomplete external amount snapshot");
            }
            BigDecimal externalAmount = locked.amount().multiply(candidateRate)
                    .setScale(2, RoundingMode.HALF_UP);
            return payments.save(locked.withFxDetails(externalAmount, "USD", candidateRate, Instant.now()));
        });
    }

    /** Persists a provider reference under the same payment-row lock after a provider response. */
    public Payment persistProviderReference(UUID paymentId, String providerReference) {
        if (providerReference == null || providerReference.isBlank()) {
            throw new IllegalArgumentException("providerReference is required");
        }
        return transactions.execute(status -> {
            Payment locked = payments.findByIdForUpdate(paymentId)
                    .orElseThrow(() -> new IllegalArgumentException("payment not found"));
            if (locked.transactionRef() != null
                    && !locked.transactionRef().isBlank()
                    && !legacyStripePlaceholder(locked, providerReference)) {
                return locked;
            }
            return payments.save(locked.withResult(locked.status(), providerReference));
        });
    }

    private static boolean legacyStripePlaceholder(Payment payment, String providerReference) {
        return payment.method() == PaymentMethod.STRIPE
                && providerReference.startsWith("pi_")
                && ("STRIPE-" + payment.paymentId()).equals(payment.transactionRef());
    }

    private static boolean requiresExternalCurrency(PaymentMethod method) {
        return method == PaymentMethod.STRIPE || method == PaymentMethod.PAYPAL;
    }

    private static boolean hasCompleteSnapshot(Payment payment) {
        return payment.externalAmount() != null
                && payment.externalCurrency() != null && !payment.externalCurrency().isBlank()
                && payment.fxRate() != null
                && payment.fxRateAt() != null;
    }

    private static boolean hasAnySnapshotValue(Payment payment) {
        return payment.externalAmount() != null
                || payment.externalCurrency() != null
                || payment.fxRate() != null
                || payment.fxRateAt() != null;
    }
}
