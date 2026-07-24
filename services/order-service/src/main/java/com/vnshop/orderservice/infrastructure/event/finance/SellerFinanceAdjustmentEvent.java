package com.vnshop.orderservice.infrastructure.event.finance;

import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.domain.finance.FinancialComponents;
import java.time.Instant;
import java.util.UUID;

public record SellerFinanceAdjustmentEvent(
        UUID eventId,
        String eventType,
        int schemaVersion,
        String occurredAt,
        String producer,
        String aggregateId,
        String correlationId,
        String causationId,
        Payload payload) {

    private static final int SCHEMA_VERSION = 1;
    private static final String EVENT_TYPE = "SELLER_FINANCE_ADJUSTMENT";

    public static SellerFinanceAdjustmentEvent credit(SubOrderFinancialAllocation allocation, Instant occurredAt) {
        return credit(allocation, allocation.allocationId().toString(), occurredAt);
    }

    public static SellerFinanceAdjustmentEvent credit(
            SubOrderFinancialAllocation allocation, String causationId, Instant occurredAt) {
        return create(allocation, "CREDIT", causationId, occurredAt, null);
    }

    public static SellerFinanceAdjustmentEvent release(
            SubOrderFinancialAllocation allocation, String buyerId, Instant occurredAt) {
        String causationId = UUID.nameUUIDFromBytes(("buyer-confirmed:" + allocation.orderId() + ":" + allocation.subOrderId())
                .getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
        return create(allocation, "RELEASE", causationId, occurredAt,
                new ReleaseMetadata("BUYER_CONFIRMED", buyerId, occurredAt.toString()));
    }

    public static SellerFinanceAdjustmentEvent reversal(
            SubOrderFinancialAllocation allocation, UUID reversalId,
            FinancialComponents components, Instant occurredAt) {
        return create(allocation, "REFUND_REVERSAL", reversalId.toString(), occurredAt, null,
                reversalId, components);
    }

    public static SellerFinanceAdjustmentEvent chargebackHold(
            SubOrderFinancialAllocation allocation, UUID chargebackId,
            FinancialComponents components, Instant occurredAt) {
        return create(allocation, "CHARGEBACK_HOLD", chargebackId.toString(), occurredAt, null,
                chargebackId, components);
    }

    public static SellerFinanceAdjustmentEvent chargebackRelease(
            SubOrderFinancialAllocation allocation, UUID chargebackId,
            FinancialComponents components, Instant occurredAt) {
        return create(allocation, "CHARGEBACK_RELEASE", chargebackId.toString(), occurredAt, null,
                chargebackId, components);
    }

    public static SellerFinanceAdjustmentEvent chargebackFinalize(
            SubOrderFinancialAllocation allocation, UUID chargebackId,
            FinancialComponents components, Instant occurredAt) {
        return create(allocation, "CHARGEBACK_FINALIZE", chargebackId.toString(), occurredAt, null,
                chargebackId, components);
    }

    private static SellerFinanceAdjustmentEvent create(
            SubOrderFinancialAllocation allocation,
            String adjustmentType,
            String causationId,
            Instant occurredAt,
            ReleaseMetadata releaseMetadata) {
        return create(allocation, adjustmentType, causationId, occurredAt, releaseMetadata,
                null, allocation.components());
    }

    private static SellerFinanceAdjustmentEvent create(
            SubOrderFinancialAllocation allocation,
            String adjustmentType,
            String causationId,
            Instant occurredAt,
            ReleaseMetadata releaseMetadata,
            UUID reversalId,
            FinancialComponents components) {
        return new SellerFinanceAdjustmentEvent(
                UUID.randomUUID(), EVENT_TYPE, SCHEMA_VERSION, occurredAt.toString(), "order-service",
                allocation.sellerId(), allocation.orderId().toString(), causationId,
                new Payload(reversalId == null ? UUID.randomUUID() : reversalId, adjustmentType, allocation.allocationId(), allocation.allocationVersion(),
                        allocation.orderId(), allocation.subOrderId(), allocation.sellerId(), allocation.commissionTier().name(),
                        allocation.frozenCommissionRate(), reversalId, components.currency(), components, releaseMetadata));
    }

    public record Payload(
            UUID adjustmentId,
            String adjustmentType,
            UUID allocationId,
            int allocationVersion,
            UUID orderId,
            Long subOrderId,
            String sellerId,
            String commissionTier,
            java.math.BigDecimal frozenCommissionRate,
            UUID reversalId,
            String currency,
            FinancialComponents components,
            ReleaseMetadata releaseMetadata) {
    }

    public record ReleaseMetadata(String reason, String confirmedBy, String confirmedAt) {
    }
}
