package com.vnshop.orderservice.domain.finance;

import com.vnshop.orderservice.domain.CommissionTier;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public record SubOrderFinancialAllocation(
        UUID allocationId,
        int allocationVersion,
        UUID orderId,
        Long subOrderId,
        String sellerId,
        CommissionTier commissionTier,
        BigDecimal frozenCommissionRate,
        FinancialComponents components,
        Source source,
        Instant createdAt) {

    public enum Source { NATIVE_V1, LEGACY_BACKFILL }

    public SubOrderFinancialAllocation {
        Objects.requireNonNull(allocationId, "allocationId is required");
        if (allocationVersion <= 0) throw new IllegalArgumentException("allocationVersion must be positive");
        Objects.requireNonNull(orderId, "orderId is required");
        Objects.requireNonNull(subOrderId, "subOrderId is required");
        if (sellerId == null || sellerId.isBlank()) throw new IllegalArgumentException("sellerId is required");
        Objects.requireNonNull(commissionTier, "commissionTier is required");
        Objects.requireNonNull(frozenCommissionRate, "frozenCommissionRate is required");
        Objects.requireNonNull(components, "components is required");
        Objects.requireNonNull(source, "source is required");
        Objects.requireNonNull(createdAt, "createdAt is required");
    }
}
