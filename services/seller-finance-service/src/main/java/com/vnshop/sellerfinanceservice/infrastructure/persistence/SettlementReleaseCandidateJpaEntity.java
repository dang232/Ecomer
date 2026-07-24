package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.FinancialAdjustment;
import com.vnshop.sellerfinanceservice.domain.SettlementReleaseCandidate;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "seller_finance_svc", name = "settlement_release_candidates")
public class SettlementReleaseCandidateJpaEntity extends BaseJpaEntity {
    @Id
    @Column(name = "allocation_id", nullable = false)
    private UUID allocationId;

    @Column(name = "allocation_version", nullable = false)
    private int allocationVersion;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "sub_order_id", nullable = false)
    private long subOrderId;

    @Column(name = "seller_id", nullable = false)
    private String sellerId;

    @Column(name = "commission_tier", nullable = false)
    private String commissionTier;

    @Column(name = "frozen_commission_rate", nullable = false, precision = 5, scale = 4)
    private BigDecimal frozenCommissionRate;

    @Column(name = "item_gmv_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal itemGmvAmount;
    @Column(name = "seller_funded_discount_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal sellerFundedDiscountAmount;
    @Column(name = "platform_funded_discount_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal platformFundedDiscountAmount;
    @Column(name = "buyer_shipping_charge_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal buyerShippingChargeAmount;
    @Column(name = "seller_shipping_payable_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal sellerShippingPayableAmount;
    @Column(name = "tax_charged_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal taxChargedAmount;
    @Column(name = "seller_tax_payable_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal sellerTaxPayableAmount;
    @Column(name = "commission_base_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal commissionBaseAmount;
    @Column(name = "platform_commission_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal platformCommissionAmount;
    @Column(name = "seller_payable_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal sellerPayableAmount;
    @Column(name = "buyer_paid_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal buyerPaidAmount;
    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "delivered_at")
    private Instant deliveredAt;
    @Column(name = "return_hold", nullable = false)
    private boolean returnHold;
    @Column(name = "dispute_hold", nullable = false)
    private boolean disputeHold;
    @Column(name = "fraud_hold", nullable = false)
    private boolean fraudHold;
    @Column(name = "chargeback_hold", nullable = false)
    private boolean chargebackHold;

    @Enumerated(EnumType.STRING)
    @Column(name = "release_status", nullable = false, length = 32)
    private SettlementReleaseCandidate.ReleaseStatus releaseStatus;

    @Column(name = "release_operation_id", nullable = false)
    private UUID releaseOperationId;
    @Column(name = "released_at")
    private Instant releasedAt;

    protected SettlementReleaseCandidateJpaEntity() {
    }

    static SettlementReleaseCandidateJpaEntity fromCredit(FinancialAdjustment adjustment) {
        SettlementReleaseCandidate candidate = SettlementReleaseCandidate.fromCredit(adjustment);
        SettlementReleaseCandidateJpaEntity entity = new SettlementReleaseCandidateJpaEntity();
        entity.apply(candidate);
        return entity;
    }

    SettlementReleaseCandidate toDomain() {
        return new SettlementReleaseCandidate(allocationId, allocationVersion, orderId, subOrderId, sellerId,
                commissionTier, frozenCommissionRate, components(), deliveredAt, returnHold, disputeHold,
                fraudHold, chargebackHold, releaseStatus, releaseOperationId, releasedAt);
    }

    void apply(SettlementReleaseCandidate candidate) {
        allocationId = candidate.allocationId();
        allocationVersion = candidate.allocationVersion();
        orderId = candidate.orderId();
        subOrderId = candidate.subOrderId();
        sellerId = candidate.sellerId();
        commissionTier = candidate.commissionTier();
        frozenCommissionRate = candidate.frozenCommissionRate();
        FinancialAdjustment.Components components = candidate.components();
        itemGmvAmount = components.itemGmvAmount();
        sellerFundedDiscountAmount = components.sellerFundedDiscountAmount();
        platformFundedDiscountAmount = components.platformFundedDiscountAmount();
        buyerShippingChargeAmount = components.buyerShippingChargeAmount();
        sellerShippingPayableAmount = components.sellerShippingPayableAmount();
        taxChargedAmount = components.taxChargedAmount();
        sellerTaxPayableAmount = components.sellerTaxPayableAmount();
        commissionBaseAmount = components.commissionBaseAmount();
        platformCommissionAmount = components.platformCommissionAmount();
        sellerPayableAmount = components.sellerPayableAmount();
        buyerPaidAmount = components.buyerPaidAmount();
        currency = components.currency();
        deliveredAt = candidate.deliveredAt();
        returnHold = candidate.returnHold();
        disputeHold = candidate.disputeHold();
        fraudHold = candidate.fraudHold();
        chargebackHold = candidate.chargebackHold();
        releaseStatus = candidate.releaseStatus();
        releaseOperationId = candidate.releaseOperationId();
        releasedAt = candidate.releasedAt();
    }

    void markDelivered(Instant value) {
        if (deliveredAt == null || value.isBefore(deliveredAt)) deliveredAt = value;
    }

    void applyHold(FinancialAdjustment.AdjustmentType adjustmentType) {
        switch (adjustmentType) {
            case REFUND_REVERSAL -> returnHold = true;
            case CHARGEBACK_HOLD -> chargebackHold = true;
            case CHARGEBACK_RELEASE -> chargebackHold = false;
            case CHARGEBACK_FINALIZE -> {
                chargebackHold = true;
                releaseStatus = SettlementReleaseCandidate.ReleaseStatus.BLOCKED;
            }
            default -> { }
        }
    }

    void updateHold(String holdType, boolean open) {
        switch (holdType) {
            case "RETURN" -> returnHold = open;
            case "DISPUTE" -> disputeHold = open;
            case "FRAUD" -> fraudHold = open;
            default -> throw new IllegalArgumentException("unsupported settlement hold type " + holdType);
        }
    }

    void markReleased(UUID operationId, Instant value) {
        if (!releaseOperationId.equals(operationId)) {
            throw new IllegalStateException("release operation key does not match candidate");
        }
        if (releaseStatus == SettlementReleaseCandidate.ReleaseStatus.RELEASED) return;
        if (releaseStatus != SettlementReleaseCandidate.ReleaseStatus.PENDING) {
            throw new IllegalStateException("settlement candidate is blocked");
        }
        releaseStatus = SettlementReleaseCandidate.ReleaseStatus.RELEASED;
        releasedAt = value;
    }

    private FinancialAdjustment.Components components() {
        return new FinancialAdjustment.Components(itemGmvAmount, sellerFundedDiscountAmount,
                platformFundedDiscountAmount, buyerShippingChargeAmount, sellerShippingPayableAmount,
                taxChargedAmount, sellerTaxPayableAmount, commissionBaseAmount, platformCommissionAmount,
                sellerPayableAmount, buyerPaidAmount, currency);
    }
}
