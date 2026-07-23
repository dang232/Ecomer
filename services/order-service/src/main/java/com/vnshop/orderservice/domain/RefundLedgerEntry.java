package com.vnshop.orderservice.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/** Durable financial evidence for a provider refund event. */
public record RefundLedgerEntry(
        String refundId,
        UUID orderId,
        UUID returnId,
        String sellerId,
        BigDecimal amount,
        String currency,
        Instant refundedAt,
        String status
) {
    public RefundLedgerEntry {
        requireNonBlank(refundId, "refundId");
        Objects.requireNonNull(orderId, "orderId is required");
        Objects.requireNonNull(amount, "amount is required");
        if (amount.signum() <= 0) {
            throw new IllegalArgumentException("amount must be positive");
        }
        requireNonBlank(currency, "currency");
        currency = currency.trim().toUpperCase(Locale.ROOT);
        if (!"VND".equals(currency)) {
            throw new IllegalArgumentException("refund ledger supports VND amounts only");
        }
        Objects.requireNonNull(refundedAt, "refundedAt is required");
        requireNonBlank(status, "status");
        status = status.trim().toUpperCase(Locale.ROOT);
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
