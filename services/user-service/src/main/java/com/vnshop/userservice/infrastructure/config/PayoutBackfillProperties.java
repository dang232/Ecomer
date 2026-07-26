package com.vnshop.userservice.infrastructure.config;

import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination.VerificationState;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration for the guarded one-shot legacy payout backfill. */
@ConfigurationProperties(prefix = "vnshop.crypto.payout.backfill")
public record PayoutBackfillProperties(boolean enabled, String verificationState) {

    public PayoutBackfillProperties {
        if (verificationState == null || verificationState.isBlank()) {
            throw new IllegalStateException(
                    "vnshop.crypto.payout.backfill.verification-state must be configured");
        }
        try {
            VerificationState.valueOf(verificationState);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException(
                    "unknown payout backfill verification state: " + verificationState, ex);
        }
    }

    public VerificationState verificationStateValue() {
        return VerificationState.valueOf(verificationState);
    }
}
