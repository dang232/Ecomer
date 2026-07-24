package com.vnshop.sellerfinanceservice.infrastructure.web;

import com.vnshop.sellerfinanceservice.domain.SellerWallet;

import java.math.BigDecimal;
import java.time.Instant;

public record WalletResponse(
        String sellerId,
        BigDecimal availableBalance,
        BigDecimal pendingBalance,
        BigDecimal settlementPendingBalance,
        BigDecimal reserveBalance,
        BigDecimal payoutPendingBalance,
        BigDecimal debtBalance,
        BigDecimal totalFees,
        BigDecimal totalRefunded,
        BigDecimal totalPaidOut,
        BigDecimal totalEarned,
        Instant lastPayoutAt) {
    static WalletResponse fromDomain(SellerWallet wallet) {
        return new WalletResponse(wallet.sellerId(), wallet.availableBalance(), wallet.pendingBalance(),
                wallet.settlementPendingBalance(), wallet.reserveBalance(), wallet.payoutPendingBalance(),
                wallet.debtBalance(), wallet.totalFees(), wallet.totalRefunded(), wallet.totalPaidOut(),
                wallet.totalEarned(), wallet.lastPayoutAt());
    }
}
