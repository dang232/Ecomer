package com.vnshop.sellerfinanceservice.domain;

import com.vnshop.sellerfinanceservice.domain.port.out.ChargebackHoldAllocationRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutEligibilityPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Default {@link PayoutEligibilityPort} implementation. Fails closed whenever the
 * wallet projection equation does not balance or any chargeback hold is still in
 * {@code HELD} status.
 */
public class PayoutEligibilityService implements PayoutEligibilityPort {
    private final SellerWalletRepositoryPort walletRepository;
    private final ChargebackHoldAllocationRepositoryPort holdRepository;

    public PayoutEligibilityService(SellerWalletRepositoryPort walletRepository,
                                    ChargebackHoldAllocationRepositoryPort holdRepository) {
        this.walletRepository = Objects.requireNonNull(walletRepository, "walletRepository is required");
        this.holdRepository = Objects.requireNonNull(holdRepository, "holdRepository is required");
    }

    @Override
    public Eligibility check(String sellerId) {
        return check(sellerId, BigDecimal.ZERO);
    }

    @Override
    public Eligibility check(String sellerId, BigDecimal requestedAmount) {
        Objects.requireNonNull(sellerId, "sellerId is required");
        Objects.requireNonNull(requestedAmount, "requestedAmount is required");
        List<Reason> reasons = new ArrayList<>();
        var walletOpt = walletRepository.findBySellerId(sellerId);
        if (walletOpt.isEmpty()) {
            reasons.add(new Reason(Reason.Code.WALLET_NOT_FOUND, "no wallet for " + sellerId, null));
            return new Eligibility(Outcome.INELIGIBLE, sellerId, BigDecimal.ZERO, List.copyOf(reasons));
        }
        SellerWallet w = walletOpt.get();
        if (!w.projectionEquationHolds()) {
            reasons.add(new Reason(Reason.Code.PROJECTION_MISMATCH,
                    "reconstructed buckets do not match totalEarned for " + sellerId, null));
        }
        // Wallet-tracked holds (single source of truth inside the projection)
        for (var allocation : w.openChargebackHolds()) {
            reasons.add(new Reason(Reason.Code.BLOCKING_HOLD,
                    "open chargeback hold " + allocation.holdId(), allocation.holdId()));
        }
        // Persistent allocations registered by the ledger but not yet reflected in the wallet
        // (defensive cross-check; in a healthy run both views agree).
        for (var record : persistentHeldAllocations(sellerId)) {
            boolean alreadyReported = reasons.stream()
                    .anyMatch(r -> r.holdId() != null && r.holdId().equals(record.holdId()));
            if (!alreadyReported) {
                reasons.add(new Reason(Reason.Code.BLOCKING_HOLD,
                        "persistent held allocation " + record.holdId(), record.holdId()));
            }
        }
        BigDecimal available = w.availableBalance();
        if (requestedAmount.compareTo(available) > 0) {
            reasons.add(new Reason(Reason.Code.INSUFFICIENT_AVAILABLE,
                    "requested " + requestedAmount + " exceeds available " + available, null));
        }
        Outcome outcome = reasons.isEmpty() ? Outcome.ELIGIBLE : Outcome.INELIGIBLE;
        return new Eligibility(outcome, sellerId, available, List.copyOf(reasons));
    }

    private List<ChargebackHoldAllocationRepositoryPort.HoldRecord> persistentHeldAllocations(String sellerId) {
        return holdRepository.findHeldBySellerId(sellerId);
    }
}
