package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.infrastructure.persistence.BaseJpaEntity;
import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(schema = "seller_finance_svc", name = "seller_wallets")
@Getter
@Setter
public class SellerWalletJpaEntity extends BaseJpaEntity {
    @Id
    @Column(name = "seller_id")
    private String sellerId;

    @Column(name = "available_balance", nullable = false, precision = 19, scale = 2)
    private BigDecimal availableBalance;

    @Column(name = "pending_balance", nullable = false, precision = 19, scale = 2)
    private BigDecimal pendingBalance;

    @Column(name = "settlement_pending_balance", nullable = false, precision = 19, scale = 2)
    private BigDecimal settlementPendingBalance;

    @Column(name = "reserve_balance", nullable = false, precision = 19, scale = 2)
    private BigDecimal reserveBalance;

    @Column(name = "payout_pending_balance", nullable = false, precision = 19, scale = 2)
    private BigDecimal payoutPendingBalance;

    @Column(name = "debt_balance", nullable = false, precision = 19, scale = 2)
    private BigDecimal debtBalance;

    @Column(name = "total_fees", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalFees;

    @Column(name = "total_refunded", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalRefunded;

    @Column(name = "total_paid_out", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalPaidOut;

    @Column(name = "total_earned", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalEarned;

    @Column(name = "last_payout_at")
    private Instant lastPayoutAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected SellerWalletJpaEntity() {
    }

    static SellerWalletJpaEntity fromDomain(SellerWallet wallet) {
        SellerWalletJpaEntity entity = new SellerWalletJpaEntity();
        entity.applyDomain(wallet);
        return entity;
    }

    void applyDomain(SellerWallet wallet) {
        this.sellerId = wallet.sellerId();
        this.availableBalance = wallet.availableBalance();
        this.pendingBalance = wallet.pendingBalance();
        this.settlementPendingBalance = wallet.settlementPendingBalance();
        this.reserveBalance = wallet.reserveBalance();
        this.payoutPendingBalance = wallet.payoutPendingBalance();
        this.debtBalance = wallet.debtBalance();
        this.totalFees = wallet.totalFees();
        this.totalRefunded = wallet.totalRefunded();
        this.totalPaidOut = wallet.totalPaidOut();
        this.totalEarned = wallet.totalEarned();
        this.lastPayoutAt = wallet.lastPayoutAt();
        this.version = wallet.version();
    }

    SellerWallet toDomain() {
        return new SellerWallet(sellerId, availableBalance, settlementPendingBalance, reserveBalance,
                payoutPendingBalance, debtBalance, totalFees, totalRefunded, totalPaidOut,
                totalEarned, lastPayoutAt, version);
    }
}
