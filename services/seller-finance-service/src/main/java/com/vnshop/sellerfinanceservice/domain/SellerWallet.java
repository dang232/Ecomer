package com.vnshop.sellerfinanceservice.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

public class SellerWallet {
    private final String sellerId;
    private BigDecimal availableBalance;
    private BigDecimal settlementPendingBalance;
    private BigDecimal reserveBalance;
    private BigDecimal payoutPendingBalance;
    private BigDecimal debtBalance;
    private BigDecimal totalFees;
    private BigDecimal totalRefunded;
    private BigDecimal totalPaidOut;
    private BigDecimal totalEarned;
    private Instant lastPayoutAt;
    private long version;

    public SellerWallet(String sellerId) {
        this(sellerId, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null, 0);
    }

    /** Compatibility constructor for the pre-ledger wallet API. */
    public SellerWallet(String sellerId, BigDecimal availableBalance, BigDecimal pendingBalance,
                        BigDecimal totalEarned, Instant lastPayoutAt) {
        this(sellerId, availableBalance, BigDecimal.ZERO, BigDecimal.ZERO, pendingBalance, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, totalEarned, lastPayoutAt, 0);
    }

    public SellerWallet(String sellerId, BigDecimal availableBalance, BigDecimal settlementPendingBalance,
                        BigDecimal reserveBalance, BigDecimal payoutPendingBalance, BigDecimal debtBalance,
                        BigDecimal totalFees, BigDecimal totalRefunded, BigDecimal totalPaidOut,
                        BigDecimal totalEarned, Instant lastPayoutAt, long version) {
        requireNonBlank(sellerId, "sellerId");
        this.sellerId = sellerId;
        this.availableBalance = requireNonNegative(availableBalance, "availableBalance");
        this.settlementPendingBalance = requireNonNegative(settlementPendingBalance, "settlementPendingBalance");
        this.reserveBalance = requireNonNegative(reserveBalance, "reserveBalance");
        this.payoutPendingBalance = requireNonNegative(payoutPendingBalance, "payoutPendingBalance");
        this.debtBalance = requireNonNegative(debtBalance, "debtBalance");
        this.totalFees = requireNonNegative(totalFees, "totalFees");
        this.totalRefunded = requireNonNegative(totalRefunded, "totalRefunded");
        this.totalPaidOut = requireNonNegative(totalPaidOut, "totalPaidOut");
        this.totalEarned = requireNonNegative(totalEarned, "totalEarned");
        this.lastPayoutAt = lastPayoutAt;
        if (version < 0) {
            throw new IllegalArgumentException("version must not be negative");
        }
        this.version = version;
    }

    public String sellerId() { return sellerId; }
    public BigDecimal availableBalance() { return availableBalance; }
    public BigDecimal settlementPendingBalance() { return settlementPendingBalance; }
    public BigDecimal reserveBalance() { return reserveBalance; }
    public BigDecimal payoutPendingBalance() { return payoutPendingBalance; }
    public BigDecimal debtBalance() { return debtBalance; }
    public BigDecimal totalFees() { return totalFees; }
    public BigDecimal totalRefunded() { return totalRefunded; }
    public BigDecimal totalPaidOut() { return totalPaidOut; }
    public BigDecimal totalEarned() { return totalEarned; }
    public Instant lastPayoutAt() { return lastPayoutAt; }
    public long version() { return version; }

    /** Compatibility alias retained while old web clients are migrated. */
    public BigDecimal pendingBalance() { return payoutPendingBalance; }

    /** Legacy direct credit; new settlement events use {@link #creditSettlement}. */
    public void credit(BigDecimal amount) {
        BigDecimal creditAmount = requirePositive(amount, "amount");
        availableBalance = availableBalance.add(creditAmount);
        totalEarned = totalEarned.add(creditAmount);
    }

    public void creditSettlement(BigDecimal amount, BigDecimal fee) {
        BigDecimal creditAmount = requirePositive(amount, "amount");
        BigDecimal feeAmount = requireNonNegative(fee, "fee");
        totalEarned = totalEarned.add(creditAmount);
        totalFees = totalFees.add(feeAmount);
        BigDecimal debtCleared = min(debtBalance, creditAmount);
        debtBalance = debtBalance.subtract(debtCleared);
        settlementPendingBalance = settlementPendingBalance.add(creditAmount.subtract(debtCleared));
    }

    /** Refund recovery consumes unsettled, available, reserve, payout-pending, then debt. */
    public void applyRefund(BigDecimal amount) {
        BigDecimal remaining = requirePositive(amount, "amount");
        BigDecimal consumed = consumeSettlementPending(remaining);
        remaining = remaining.subtract(consumed);
        consumed = consumeAvailable(remaining);
        remaining = remaining.subtract(consumed);
        consumed = consumeReserve(remaining);
        remaining = remaining.subtract(consumed);
        consumed = consumePayoutPending(remaining);
        remaining = remaining.subtract(consumed);
        debtBalance = debtBalance.add(remaining);
        totalRefunded = totalRefunded.add(amount);
    }

    /** Compatibility refund debit. */
    public void debit(BigDecimal amount) { applyRefund(amount); }

    public void releaseSettlement(BigDecimal amount) {
        BigDecimal releaseAmount = requirePositive(amount, "amount");
        requireSufficient(settlementPendingBalance, releaseAmount, "settlement pending balance");
        settlementPendingBalance = settlementPendingBalance.subtract(releaseAmount);
        availableBalance = availableBalance.add(releaseAmount);
    }

    public void reservePayout(BigDecimal amount) {
        BigDecimal payoutAmount = requirePositive(amount, "amount");
        requireSufficient(availableBalance, payoutAmount, "available balance");
        availableBalance = availableBalance.subtract(payoutAmount);
        payoutPendingBalance = payoutPendingBalance.add(payoutAmount);
    }

    public void completePayout(BigDecimal amount, Instant completedAt) {
        BigDecimal payoutAmount = requirePositive(amount, "amount");
        requireSufficient(payoutPendingBalance, payoutAmount, "payout pending balance");
        payoutPendingBalance = payoutPendingBalance.subtract(payoutAmount);
        totalPaidOut = totalPaidOut.add(payoutAmount);
        lastPayoutAt = Objects.requireNonNull(completedAt, "completedAt is required");
    }

    public void failPayout(BigDecimal amount) {
        BigDecimal payoutAmount = requirePositive(amount, "amount");
        requireSufficient(payoutPendingBalance, payoutAmount, "payout pending balance");
        payoutPendingBalance = payoutPendingBalance.subtract(payoutAmount);
        availableBalance = availableBalance.add(payoutAmount);
    }

    public boolean projectionEquationHolds() {
        BigDecimal reconstructed = settlementPendingBalance
                .add(availableBalance)
                .add(reserveBalance)
                .add(payoutPendingBalance)
                .add(totalRefunded)
                .add(totalPaidOut)
                .subtract(debtBalance);
        return reconstructed.compareTo(totalEarned) == 0;
    }

    private BigDecimal consumeSettlementPending(BigDecimal amount) {
        BigDecimal consumed = min(settlementPendingBalance, amount);
        settlementPendingBalance = settlementPendingBalance.subtract(consumed);
        return consumed;
    }

    private BigDecimal consumeAvailable(BigDecimal amount) {
        BigDecimal consumed = min(availableBalance, amount);
        availableBalance = availableBalance.subtract(consumed);
        return consumed;
    }

    private BigDecimal consumeReserve(BigDecimal amount) {
        BigDecimal consumed = min(reserveBalance, amount);
        reserveBalance = reserveBalance.subtract(consumed);
        return consumed;
    }

    private BigDecimal consumePayoutPending(BigDecimal amount) {
        BigDecimal consumed = min(payoutPendingBalance, amount);
        payoutPendingBalance = payoutPendingBalance.subtract(consumed);
        return consumed;
    }

    private static BigDecimal min(BigDecimal first, BigDecimal second) {
        return first.min(second.max(BigDecimal.ZERO));
    }

    private static void requireSufficient(BigDecimal balance, BigDecimal amount, String name) {
        if (balance.compareTo(amount) < 0) {
            throw new IllegalArgumentException(name + " is insufficient");
        }
    }

    private static BigDecimal requireNonNegative(BigDecimal value, String fieldName) {
        Objects.requireNonNull(value, fieldName + " is required");
        if (value.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(fieldName + " must not be negative");
        }
        return value;
    }

    private static BigDecimal requirePositive(BigDecimal value, String fieldName) {
        Objects.requireNonNull(value, fieldName + " is required");
        if (value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(fieldName + " must be greater than zero");
        }
        return value;
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
