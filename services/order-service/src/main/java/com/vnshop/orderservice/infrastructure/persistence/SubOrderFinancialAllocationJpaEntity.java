package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.CommissionTier;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;

@Entity
@Table(schema = "order_svc", name = "sub_order_financial_allocations")
@Getter
public class SubOrderFinancialAllocationJpaEntity extends BaseJpaEntity {
    @Id @Column(name = "allocation_id", nullable = false) private UUID allocationId;
    @Column(name = "allocation_version", nullable = false) private int allocationVersion;
    @Column(name = "order_id", nullable = false) private UUID orderId;
    @Column(name = "sub_order_id", nullable = false) private Long subOrderId;
    @Column(name = "seller_id", nullable = false) private String sellerId;
    @Enumerated(EnumType.STRING) @Column(name = "commission_tier", nullable = false) private CommissionTier commissionTier;
    @Column(name = "frozen_commission_rate", nullable = false, precision = 5, scale = 4) private BigDecimal frozenCommissionRate;
    @Column(name = "item_gmv_amount", nullable = false, precision = 19, scale = 0) private BigDecimal itemGmvAmount;
    @Column(name = "seller_funded_discount_amount", nullable = false, precision = 19, scale = 0) private BigDecimal sellerFundedDiscountAmount;
    @Column(name = "platform_funded_discount_amount", nullable = false, precision = 19, scale = 0) private BigDecimal platformFundedDiscountAmount;
    @Column(name = "buyer_shipping_charge_amount", nullable = false, precision = 19, scale = 0) private BigDecimal buyerShippingChargeAmount;
    @Column(name = "seller_shipping_payable_amount", nullable = false, precision = 19, scale = 0) private BigDecimal sellerShippingPayableAmount;
    @Column(name = "tax_charged_amount", nullable = false, precision = 19, scale = 0) private BigDecimal taxChargedAmount;
    @Column(name = "seller_tax_payable_amount", nullable = false, precision = 19, scale = 0) private BigDecimal sellerTaxPayableAmount;
    @Column(name = "commission_base_amount", nullable = false, precision = 19, scale = 0) private BigDecimal commissionBaseAmount;
    @Column(name = "platform_commission_amount", nullable = false, precision = 19, scale = 0) private BigDecimal platformCommissionAmount;
    @Column(name = "seller_payable_amount", nullable = false, precision = 19, scale = 0) private BigDecimal sellerPayableAmount;
    @Column(name = "buyer_paid_amount", nullable = false, precision = 19, scale = 0) private BigDecimal buyerPaidAmount;
    @Column(name = "currency", nullable = false, length = 3) private String currency;
    @Enumerated(EnumType.STRING) @Column(name = "source", nullable = false) private SubOrderFinancialAllocation.Source source;
    @Column(name = "allocated_at", nullable = false) private Instant allocatedAt;

    protected SubOrderFinancialAllocationJpaEntity() { }

    static SubOrderFinancialAllocationJpaEntity fromDomain(SubOrderFinancialAllocation allocation) {
        var entity = new SubOrderFinancialAllocationJpaEntity();
        var components = allocation.components();
        entity.allocationId = allocation.allocationId(); entity.allocationVersion = allocation.allocationVersion();
        entity.orderId = allocation.orderId(); entity.subOrderId = allocation.subOrderId(); entity.sellerId = allocation.sellerId();
        entity.commissionTier = allocation.commissionTier(); entity.frozenCommissionRate = allocation.frozenCommissionRate();
        entity.itemGmvAmount = components.itemGmvAmount(); entity.sellerFundedDiscountAmount = components.sellerFundedDiscountAmount();
        entity.platformFundedDiscountAmount = components.platformFundedDiscountAmount(); entity.buyerShippingChargeAmount = components.buyerShippingChargeAmount();
        entity.sellerShippingPayableAmount = components.sellerShippingPayableAmount(); entity.taxChargedAmount = components.taxChargedAmount();
        entity.sellerTaxPayableAmount = components.sellerTaxPayableAmount(); entity.commissionBaseAmount = components.commissionBaseAmount();
        entity.platformCommissionAmount = components.platformCommissionAmount(); entity.sellerPayableAmount = components.sellerPayableAmount();
        entity.buyerPaidAmount = components.buyerPaidAmount(); entity.currency = components.currency(); entity.source = allocation.source();
        entity.allocatedAt = allocation.createdAt();
        return entity;
    }
}
