package com.vnshop.paymentservice.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Immutable provider refund evidence keyed by the business reversal id. */
public record PaymentRefundRecord(
        UUID reversalId,
        UUID paymentId,
        String providerRef,
        BigDecimal amount,
        String currency,
        RefundStatus status,
        Instant createdAt,
        Instant updatedAt) {

    public PaymentRefundRecord {
        Objects.requireNonNull(reversalId, "reversalId is required");
        Objects.requireNonNull(paymentId, "paymentId is required");
        if (providerRef == null || providerRef.isBlank()) {
            throw new IllegalArgumentException("providerRef is required");
        }
        Objects.requireNonNull(amount, "amount is required");
        if (amount.signum() <= 0) {
            throw new IllegalArgumentException("amount must be positive");
        }
        if (!"VND".equals(currency)) {
            throw new IllegalArgumentException("currency must be VND");
        }
        Objects.requireNonNull(status, "status is required");
        Objects.requireNonNull(createdAt, "createdAt is required");
        Objects.requireNonNull(updatedAt, "updatedAt is required");
    }

    public enum RefundStatus { COMPLETED, FAILED }
}
