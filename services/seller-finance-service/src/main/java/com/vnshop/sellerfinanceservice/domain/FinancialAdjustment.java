package com.vnshop.sellerfinanceservice.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public record FinancialAdjustment(
        UUID eventId,
        Instant occurredAt,
        UUID adjustmentId,
        AdjustmentType adjustmentType,
        UUID allocationId,
        int allocationVersion,
        UUID orderId,
        long subOrderId,
        String sellerId,
        String commissionTier,
        BigDecimal frozenCommissionRate,
        UUID reversalId,
        String currency,
        Components components,
        ReleaseMetadata releaseMetadata) {

    public FinancialAdjustment {
        Objects.requireNonNull(eventId, "eventId is required");
        Objects.requireNonNull(occurredAt, "occurredAt is required");
        Objects.requireNonNull(adjustmentId, "adjustmentId is required");
        Objects.requireNonNull(adjustmentType, "adjustmentType is required");
        Objects.requireNonNull(allocationId, "allocationId is required");
        Objects.requireNonNull(orderId, "orderId is required");
        requireNonBlank(sellerId, "sellerId");
        requireNonBlank(commissionTier, "commissionTier");
        requireNonBlank(currency, "currency");
        if (allocationVersion < 1 || subOrderId < 1) {
            throw new IllegalArgumentException("allocationVersion and subOrderId must be positive");
        }
        Objects.requireNonNull(frozenCommissionRate, "frozenCommissionRate is required");
        if (frozenCommissionRate.compareTo(BigDecimal.ZERO) < 0 || frozenCommissionRate.compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("frozenCommissionRate must be between 0 and 1");
        }
        if (!"VND".equals(currency)) {
            throw new IllegalArgumentException("currency must be VND");
        }
        Objects.requireNonNull(components, "components are required");
        if (adjustmentType == AdjustmentType.RELEASE && releaseMetadata == null) {
            throw new IllegalArgumentException("releaseMetadata is required for RELEASE");
        }
        if (adjustmentType == AdjustmentType.CREDIT && releaseMetadata != null) {
            throw new IllegalArgumentException("releaseMetadata must be absent for CREDIT");
        }
    }

    public String sourceType() {
        return "SELLER_FINANCE_ADJUSTMENT";
    }

    public String operationType() {
        return adjustmentType.name();
    }

    public enum AdjustmentType {
        CREDIT,
        RELEASE
    }

    public record Components(
            BigDecimal itemGmvAmount,
            BigDecimal sellerFundedDiscountAmount,
            BigDecimal platformFundedDiscountAmount,
            BigDecimal buyerShippingChargeAmount,
            BigDecimal sellerShippingPayableAmount,
            BigDecimal taxChargedAmount,
            BigDecimal sellerTaxPayableAmount,
            BigDecimal commissionBaseAmount,
            BigDecimal platformCommissionAmount,
            BigDecimal sellerPayableAmount,
            BigDecimal buyerPaidAmount,
            String currency) {
        public Components {
            requireNonNegative(itemGmvAmount, "itemGmvAmount");
            requireNonNegative(sellerFundedDiscountAmount, "sellerFundedDiscountAmount");
            requireNonNegative(platformFundedDiscountAmount, "platformFundedDiscountAmount");
            requireNonNegative(buyerShippingChargeAmount, "buyerShippingChargeAmount");
            requireNonNegative(sellerShippingPayableAmount, "sellerShippingPayableAmount");
            requireNonNegative(taxChargedAmount, "taxChargedAmount");
            requireNonNegative(sellerTaxPayableAmount, "sellerTaxPayableAmount");
            requireNonNegative(commissionBaseAmount, "commissionBaseAmount");
            requireNonNegative(platformCommissionAmount, "platformCommissionAmount");
            requireNonNegative(sellerPayableAmount, "sellerPayableAmount");
            requireNonNegative(buyerPaidAmount, "buyerPaidAmount");
            if (itemGmvAmount.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("itemGmvAmount must be greater than zero");
            }
            requireNonBlank(currency, "currency");
            if (!"VND".equals(currency)) {
                throw new IllegalArgumentException("components.currency must be VND");
            }
        }

        public BigDecimal creditAmount() {
            return sellerPayableAmount.add(platformCommissionAmount);
        }
    }

    public record ReleaseMetadata(String reason, String confirmedBy, Instant confirmedAt) {
        public ReleaseMetadata {
            if (!"BUYER_CONFIRMED".equals(reason)) {
                throw new IllegalArgumentException("release reason must be BUYER_CONFIRMED");
            }
            requireNonBlank(confirmedBy, "confirmedBy");
            Objects.requireNonNull(confirmedAt, "confirmedAt is required");
        }
    }

    private static void requireNonNegative(BigDecimal value, String fieldName) {
        Objects.requireNonNull(value, fieldName + " is required");
        if (value.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(fieldName + " must not be negative");
        }
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
