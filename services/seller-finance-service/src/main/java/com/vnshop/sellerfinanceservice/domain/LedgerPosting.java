package com.vnshop.sellerfinanceservice.domain;

import java.math.BigDecimal;
import java.util.Objects;

public record LedgerPosting(
        LedgerAccountCode accountCode,
        LedgerDirection direction,
        BigDecimal amount,
        String currency) {

    public LedgerPosting {
        Objects.requireNonNull(accountCode, "accountCode is required");
        Objects.requireNonNull(direction, "direction is required");
        Objects.requireNonNull(amount, "amount is required");
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("posting amount must be greater than zero");
        }
        if (currency == null || currency.isBlank()) {
            throw new IllegalArgumentException("currency is required");
        }
    }
}
