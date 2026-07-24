package com.vnshop.orderservice.domain.finance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Allocation-scoped buyer amount reserved by a refund or chargeback.
 * Amounts are immutable; only a chargeback hold may later be released or finalized.
 */
public record FinancialReversal(
        UUID reversalId,
        UUID allocationId,
        UUID orderId,
        ReversalType reversalType,
        ReversalStatus status,
        BigDecimal buyerAmount,
        String currency,
        Instant createdAt,
        Instant updatedAt) {

    public FinancialReversal {
        Objects.requireNonNull(reversalId, "reversalId is required");
        Objects.requireNonNull(allocationId, "allocationId is required");
        Objects.requireNonNull(orderId, "orderId is required");
        Objects.requireNonNull(reversalType, "reversalType is required");
        Objects.requireNonNull(status, "status is required");
        Objects.requireNonNull(buyerAmount, "buyerAmount is required");
        if (buyerAmount.signum() <= 0) {
            throw new IllegalArgumentException("buyerAmount must be positive");
        }
        if (!"VND".equals(currency)) {
            throw new IllegalArgumentException("currency must be VND");
        }
        Objects.requireNonNull(createdAt, "createdAt is required");
        Objects.requireNonNull(updatedAt, "updatedAt is required");
        if (reversalType == ReversalType.REFUND && status != ReversalStatus.FINALIZED) {
            throw new IllegalArgumentException("refund reservations must be finalized");
        }
        if (reversalType == ReversalType.CHARGEBACK && status == ReversalStatus.RELEASED) {
            throw new IllegalArgumentException("new chargeback reservations cannot be released");
        }
    }

    public boolean consumesAllocation() {
        return status == ReversalStatus.OPEN || status == ReversalStatus.FINALIZED;
    }

    public enum ReversalType {
        REFUND,
        CHARGEBACK
    }

    public enum ReversalStatus {
        OPEN,
        FINALIZED,
        RELEASED
    }
}
