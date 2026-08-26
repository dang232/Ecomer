package com.vnshop.paymentservice.infrastructure.sepay;

import com.vnshop.paymentservice.domain.Payment;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

public final class SepayTransactionValidator {
    private final SepayProperties properties;

    public SepayTransactionValidator(SepayProperties properties) {
        this.properties = Objects.requireNonNull(properties, "properties is required");
    }

    public Validation validate(Payment payment, String id, String amount, String memo,
                       String account, String currency, String direction) {
        if (id == null || id.isBlank()) return Validation.invalid("transaction id is required");
        if (amount == null || amount.isBlank()) return Validation.invalid("transaction amount is required");
        BigDecimal actual;
        try {
            actual = new BigDecimal(amount.trim());
        } catch (NumberFormatException ex) {
            return Validation.invalid("transaction amount is invalid");
        }
        if (actual.signum() <= 0 || actual.scale() > 0) return Validation.invalid("transaction amount must be positive VND whole units");
        if (actual.compareTo(payment.amount()) < 0) return Validation.invalid("underpayment is rejected");
        if (actual.compareTo(payment.amount()) > 0) {
            String policy = properties.overpaymentPolicy().trim().toUpperCase(Locale.ROOT);
            return "HOLD".equals(policy)
                    ? Validation.hold(actual, "overpayment requires reconciliation")
                    : Validation.invalid("overpayment requires " + policy + " reconciliation");
        }
        if (currency == null || currency.isBlank() || !"VND".equalsIgnoreCase(currency)) return Validation.invalid("transaction currency must be VND");
        if (direction == null || direction.isBlank() || !SetOfCredits.contains(direction)) return Validation.invalid("transaction must be a credit");
        if (properties.accountId() == null || properties.accountId().isBlank()
                || account == null || account.isBlank() || !properties.accountId().equals(account)) {
            return Validation.invalid("transaction beneficiary does not match configured account");
        }
        if (memo == null || memo.isBlank() || !memo.contains(payment.paymentId().toString())) {
            return Validation.invalid("transaction memo does not identify payment");
        }
        return Validation.valid(actual);
    }

    public record Validation(boolean accepted, BigDecimal amount, String reason) {
        static Validation valid(BigDecimal amount) { return new Validation(true, amount, null); }
        static Validation hold(BigDecimal amount, String reason) { return new Validation(false, amount, reason); }
        static Validation invalid(String reason) { return new Validation(false, null, reason); }

        public boolean held() { return amount != null && !accepted; }
    }

    private static final class SetOfCredits {
        private static boolean contains(String direction) {
            String normalized = direction.toUpperCase(Locale.ROOT);
            return normalized.equals("IN") || normalized.equals("CREDIT")
                    || normalized.equals("TRANSFER_IN") || normalized.equals("1");
        }
    }
}
