package com.vnshop.sellerfinanceservice.domain;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Immutable allocation snapshot plus the mutable delivery/hold gate state. */
public record SettlementReleaseCandidate(
        UUID allocationId,
        int allocationVersion,
        UUID orderId,
        long subOrderId,
        String sellerId,
        String commissionTier,
        BigDecimal frozenCommissionRate,
        FinancialAdjustment.Components components,
        Instant deliveredAt,
        boolean returnHold,
        boolean disputeHold,
        boolean fraudHold,
        boolean chargebackHold,
        ReleaseStatus releaseStatus,
        UUID releaseOperationId,
        Instant releasedAt) {

    private static final Duration AUTO_RELEASE_AFTER = Duration.ofDays(7);

    public SettlementReleaseCandidate {
        Objects.requireNonNull(allocationId, "allocationId is required");
        if (allocationVersion < 1 || subOrderId < 1) {
            throw new IllegalArgumentException("allocationVersion and subOrderId must be positive");
        }
        Objects.requireNonNull(orderId, "orderId is required");
        requireNonBlank(sellerId, "sellerId");
        requireNonBlank(commissionTier, "commissionTier");
        Objects.requireNonNull(frozenCommissionRate, "frozenCommissionRate is required");
        Objects.requireNonNull(components, "components are required");
        Objects.requireNonNull(releaseStatus, "releaseStatus is required");
        Objects.requireNonNull(releaseOperationId, "releaseOperationId is required");
        if (releaseStatus == ReleaseStatus.RELEASED && releasedAt == null) {
            throw new IllegalArgumentException("releasedAt is required for released candidates");
        }
    }

    public static SettlementReleaseCandidate fromCredit(FinancialAdjustment adjustment) {
        return new SettlementReleaseCandidate(
                adjustment.allocationId(), adjustment.allocationVersion(), adjustment.orderId(),
                adjustment.subOrderId(), adjustment.sellerId(), adjustment.commissionTier(),
                adjustment.frozenCommissionRate(), adjustment.components(), null,
                false, false, false, false, ReleaseStatus.PENDING,
                releaseOperationId(adjustment.allocationId()), null);
    }

    public static UUID releaseOperationId(UUID allocationId) {
        return UUID.nameUUIDFromBytes(("settlement-release:" + allocationId)
                .getBytes(StandardCharsets.UTF_8));
    }

    public boolean eligibleAt(Instant now) {
        return releaseStatus == ReleaseStatus.PENDING
                && deliveredAt != null
                && !deliveredAt.plus(AUTO_RELEASE_AFTER).isAfter(now)
                && !returnHold && !disputeHold && !fraudHold && !chargebackHold;
    }

    public FinancialAdjustment automaticRelease(Instant occurredAt) {
        if (!eligibleAt(occurredAt)) {
            throw new IllegalStateException("settlement candidate is not eligible for automatic release");
        }
        return new FinancialAdjustment(
                UUID.randomUUID(), occurredAt, releaseOperationId,
                FinancialAdjustment.AdjustmentType.RELEASE, allocationId, allocationVersion,
                orderId, subOrderId, sellerId, commissionTier, frozenCommissionRate, null,
                components.currency(), components,
                new FinancialAdjustment.ReleaseMetadata("AUTO_CONFIRMED", "settlement-release-scheduler", occurredAt));
    }

    public enum ReleaseStatus { PENDING, RELEASED, BLOCKED }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
