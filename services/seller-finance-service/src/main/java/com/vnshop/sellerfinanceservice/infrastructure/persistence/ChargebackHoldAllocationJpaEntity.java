package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.port.out.ChargebackHoldAllocationRepositoryPort;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(schema = "seller_finance_svc", name = "chargeback_hold_allocations")
class ChargebackHoldAllocationJpaEntity extends BaseJpaEntity {
    @Id
    @Column(name = "hold_id", nullable = false)
    private UUID holdId;

    @Column(name = "seller_id", nullable = false)
    private String sellerId;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_bucket", nullable = false, length = 32)
    private SellerWallet.WalletBucket sourceBucket;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private SellerWallet.HoldStatus status;

    protected ChargebackHoldAllocationJpaEntity() {
    }

    ChargebackHoldAllocationJpaEntity(UUID holdId, String sellerId, BigDecimal amount,
                                      SellerWallet.WalletBucket sourceBucket, SellerWallet.HoldStatus status) {
        this.holdId = holdId;
        this.sellerId = sellerId;
        this.amount = amount;
        this.sourceBucket = sourceBucket;
        this.status = status;
    }

    void updateStatus(SellerWallet.HoldStatus nextStatus) {
        this.status = nextStatus;
    }

    boolean hasSameAllocation(String expectedSellerId, BigDecimal expectedAmount,
                              SellerWallet.WalletBucket expectedSourceBucket) {
        return sellerId.equals(expectedSellerId)
                && amount.compareTo(expectedAmount) == 0
                && sourceBucket == expectedSourceBucket;
    }

    ChargebackHoldAllocationRepositoryPort.HoldRecord toRecord() {
        return new ChargebackHoldAllocationRepositoryPort.HoldRecord(
                holdId, sellerId, amount, sourceBucket, status);
    }
}
