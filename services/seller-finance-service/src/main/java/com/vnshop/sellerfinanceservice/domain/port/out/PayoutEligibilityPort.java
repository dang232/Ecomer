package com.vnshop.sellerfinanceservice.domain.port.out;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Read-side port used by the payout reservation flow to decide whether a seller may
 * reserve funds. The check fails closed whenever:
 * <ul>
 *     <li>the wallet projection equation does not balance (reconstructed != totalEarned), or</li>
 *     <li>any recorded chargeback hold is in {@code HELD} status (blocking-hold state).</li>
 * </ul>
 * Implementing services must surface every reason so the caller can emit a structured
 * {@code 409 Conflict} response.
 */
@FunctionalInterface
public interface PayoutEligibilityPort {
    Eligibility check(String sellerId);

    default Eligibility check(String sellerId, BigDecimal requestedAmount) {
        Eligibility base = check(sellerId);
        if (!base.isEligible() || requestedAmount.compareTo(base.availableForPayout()) <= 0) return base;
        return new Eligibility(Outcome.INELIGIBLE, sellerId, base.availableForPayout(),
                java.util.stream.Stream.concat(base.blockingReasons().stream(),
                        java.util.stream.Stream.of(new Reason(Reason.Code.INSUFFICIENT_AVAILABLE,
                                "requested amount exceeds available payout balance", null))).toList());
    }

    enum Outcome {
        ELIGIBLE,
        INELIGIBLE
    }

    record Eligibility(Outcome outcome, String sellerId, BigDecimal availableForPayout,
                       List<Reason> blockingReasons) {
        public boolean isEligible() { return outcome == Outcome.ELIGIBLE; }
    }

    record Reason(Code code, String detail, UUID holdId) {
        public enum Code {
            PROJECTION_MISMATCH,
            BLOCKING_HOLD,
            INSUFFICIENT_AVAILABLE,
            WALLET_NOT_FOUND
        }
    }
}
