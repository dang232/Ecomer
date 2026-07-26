package com.vnshop.sellerfinanceservice.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public class SellerWallet {
    private final String sellerId;
    private final String currency;
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
    /** In-memory ledger of every chargeback hold allocation. Persistent storage is owned by the ledger service. */
    private final Map<UUID, HoldAllocation> chargebackHolds = new LinkedHashMap<>();

    public SellerWallet(String sellerId) {
        this(sellerId, "VND", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, null, 0);
    }

    /** Compatibility constructor for the pre-ledger wallet API. */
    public SellerWallet(String sellerId, BigDecimal availableBalance, BigDecimal pendingBalance,
                        BigDecimal totalEarned, Instant lastPayoutAt) {
        this(sellerId, "VND", availableBalance, BigDecimal.ZERO, BigDecimal.ZERO, pendingBalance, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, totalEarned, lastPayoutAt, 0);
    }

    /**
     * Legacy projection-bucket constructor: caller supplies each of the nine projection
     * balances individually. Kept for compatibility with wallet-facing controller tests
     * that pre-date the currency-aware shape.
     */
    public SellerWallet(String sellerId,
                        BigDecimal availableBalance,
                        BigDecimal settlementPendingBalance,
                        BigDecimal reserveBalance,
                        BigDecimal payoutPendingBalance,
                        BigDecimal debtBalance,
                        BigDecimal totalFees,
                        BigDecimal totalRefunded,
                        BigDecimal totalPaidOut,
                        BigDecimal totalEarned,
                        Instant lastPayoutAt,
                        long version) {
        this(sellerId, "VND", availableBalance, settlementPendingBalance, reserveBalance,
                payoutPendingBalance, debtBalance, totalFees, totalRefunded, totalPaidOut,
                totalEarned, lastPayoutAt, version);
    }

    public SellerWallet(String sellerId, String currency, BigDecimal availableBalance,
                        BigDecimal settlementPendingBalance, BigDecimal reserveBalance,
                        BigDecimal payoutPendingBalance, BigDecimal debtBalance, BigDecimal totalFees,
                        BigDecimal totalRefunded, BigDecimal totalPaidOut, BigDecimal totalEarned,
                        Instant lastPayoutAt, long version) {
        requireNonBlank(sellerId, "sellerId");
        requireNonBlank(currency, "currency");
        this.sellerId = sellerId;
        this.currency = currency;
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
    public String currency() { return currency; }
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

    /**
     * Refund recovery consumes unsettled then available then reserve then debt.
     * Payout-pending is intentionally NOT a refund source — a refund that arrives
     * after the seller has reserved a payout cannot reduce the reservation.
     */
    public void applyRefund(BigDecimal amount) {
        BigDecimal remaining = requirePositive(amount, "amount");
        BigDecimal consumed = consumeSettlementPending(remaining);
        remaining = remaining.subtract(consumed);
        consumed = consumeAvailable(remaining);
        remaining = remaining.subtract(consumed);
        consumed = consumeReserve(remaining);
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

    public void reversePayoutReservation(BigDecimal amount) {
        BigDecimal payoutAmount = requirePositive(amount, "amount");
        requireSufficient(payoutPendingBalance, payoutAmount, "payout pending balance");
        payoutPendingBalance = payoutPendingBalance.subtract(payoutAmount);
        availableBalance = availableBalance.add(payoutAmount);
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

    /**
     * Chargeback hold moves the funded amount from {@code sourceBucket} into reserve and
     * records an immutable allocation so release/finalize cannot guess where the funds came from.
     * Idempotent: a second call for the same {@code holdId} is a no-op.
     */
    public HoldAllocation holdChargeback(UUID holdId, BigDecimal amount, WalletBucket sourceBucket) {
        Objects.requireNonNull(holdId, "holdId is required");
        BigDecimal holdAmount = requirePositive(amount, "amount");
        Objects.requireNonNull(sourceBucket, "sourceBucket is required");
        HoldAllocation existing = chargebackHolds.get(holdId);
        if (existing != null) {
            if (existing.amount().compareTo(holdAmount) != 0 || existing.sourceBucket() != sourceBucket) {
                throw new IllegalStateException("hold " + holdId + " already recorded with different terms");
            }
            return existing;
        }
        BigDecimal consumed = consumeFromBucket(sourceBucket, holdAmount, holdId);
        if (consumed.compareTo(holdAmount) < 0) {
            // The bucket didn't have enough; restore what we did consume so the call is atomic.
            restoreToBucket(sourceBucket, consumed);
            throw new IllegalArgumentException("insufficient funds in " + sourceBucket + " bucket for hold");
        }
        reserveBalance = reserveBalance.add(holdAmount);
        HoldAllocation allocation = new HoldAllocation(holdId, holdAmount, sourceBucket, HoldStatus.HELD);
        chargebackHolds.put(holdId, allocation);
        return allocation;
    }

    /**
     * Releases a previously held chargeback, restoring funds to the original source bucket exactly.
     * Idempotent on already-released holds.
     */
    public HoldAllocation releaseChargeback(UUID holdId) {
        Objects.requireNonNull(holdId, "holdId is required");
        HoldAllocation existing = chargebackHolds.get(holdId);
        if (existing == null) {
            throw new IllegalArgumentException("hold " + holdId + " is not recorded");
        }
        if (existing.status() == HoldStatus.RELEASED) {
            return existing;
        }
        if (existing.status() == HoldStatus.FINALIZED) {
            throw new IllegalStateException("hold " + holdId + " was finalized and cannot be released");
        }
        requireSufficient(reserveBalance, existing.amount(), "reserve balance");
        reserveBalance = reserveBalance.subtract(existing.amount());
        restoreToBucket(existing.sourceBucket(), existing.amount());
        HoldAllocation released = new HoldAllocation(existing.holdId(), existing.amount(),
                existing.sourceBucket(), HoldStatus.RELEASED);
        chargebackHolds.put(holdId, released);
        return released;
    }

    /**
     * Finalizes a held chargeback: consumes the reserve allocation without a second debit
     * against any other bucket, and records the amount in {@link #totalRefunded} because the
     * refund is now permanently realized.
     * Idempotent on already-finalized holds.
     */
    public HoldAllocation finalizeChargeback(UUID holdId) {
        Objects.requireNonNull(holdId, "holdId is required");
        HoldAllocation existing = chargebackHolds.get(holdId);
        if (existing == null) {
            throw new IllegalArgumentException("hold " + holdId + " is not recorded");
        }
        if (existing.status() == HoldStatus.FINALIZED) {
            return existing;
        }
        if (existing.status() == HoldStatus.RELEASED) {
            throw new IllegalStateException("hold " + holdId + " was released and cannot be finalized");
        }
        requireSufficient(reserveBalance, existing.amount(), "reserve balance");
        reserveBalance = reserveBalance.subtract(existing.amount());
        totalRefunded = totalRefunded.add(existing.amount());
        HoldAllocation finalized = new HoldAllocation(existing.holdId(), existing.amount(),
                existing.sourceBucket(), HoldStatus.FINALIZED);
        chargebackHolds.put(holdId, finalized);
        return finalized;
    }

    /** Snapshot of recorded chargeback holds for inspection by the payout-eligibility port. */
    public List<HoldAllocation> openChargebackHolds() {
        return chargebackHolds.values().stream()
                .filter(a -> a.status() == HoldStatus.HELD)
                .toList();
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

    private BigDecimal consumeFromBucket(WalletBucket bucket, BigDecimal amount, UUID holdId) {
        return switch (bucket) {
            case SETTLEMENT_PENDING -> {
                BigDecimal consumed = min(settlementPendingBalance, amount);
                settlementPendingBalance = settlementPendingBalance.subtract(consumed);
                yield consumed;
            }
            case AVAILABLE -> {
                BigDecimal consumed = min(availableBalance, amount);
                availableBalance = availableBalance.subtract(consumed);
                yield consumed;
            }
            case RESERVE -> {
                BigDecimal consumed = min(reserveBalance, amount);
                reserveBalance = reserveBalance.subtract(consumed);
                yield consumed;
            }
        };
    }

    private void restoreToBucket(WalletBucket bucket, BigDecimal amount) {
        switch (bucket) {
            case SETTLEMENT_PENDING -> settlementPendingBalance = settlementPendingBalance.add(amount);
            case AVAILABLE -> availableBalance = availableBalance.add(amount);
            case RESERVE -> reserveBalance = reserveBalance.add(amount);
        }
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

    public enum WalletBucket {
        SETTLEMENT_PENDING,
        AVAILABLE,
        RESERVE
    }

    public enum HoldStatus {
        HELD,
        RELEASED,
        FINALIZED
    }

    public record HoldAllocation(UUID holdId, BigDecimal amount, WalletBucket sourceBucket, HoldStatus status) {
        public HoldAllocation {
            Objects.requireNonNull(holdId, "holdId is required");
            Objects.requireNonNull(amount, "amount is required");
            Objects.requireNonNull(sourceBucket, "sourceBucket is required");
            Objects.requireNonNull(status, "status is required");
        }
    }
}