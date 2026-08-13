package com.vnshop.paymentservice.infrastructure.stripe;

import java.math.BigDecimal;
import java.util.Currency;

public final class StripeChargebackAmount {
    private StripeChargebackAmount() {
    }

    public static BigDecimal toMajorUnits(Long minorAmount, String currencyCode) {
        if (minorAmount == null) {
            return null;
        }
        if (currencyCode == null || currencyCode.isBlank()) {
            throw new IllegalArgumentException("Stripe dispute currency is required");
        }
        int fractionDigits;
        try {
            fractionDigits = Currency.getInstance(currencyCode.toUpperCase(java.util.Locale.ROOT))
                    .getDefaultFractionDigits();
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Unsupported Stripe dispute currency", exception);
        }
        return BigDecimal.valueOf(minorAmount, fractionDigits);
    }
}
