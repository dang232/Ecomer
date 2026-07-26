package com.vnshop.sellerfinanceservice.domain.port.out;

import com.vnshop.sellerfinanceservice.domain.Payout;

/** Provider boundary. Implementations must use the supplied stable idempotency key. */
public interface PayoutProviderPort {
    SubmissionResult submit(Payout payout, String providerIdempotencyKey);

    record SubmissionResult(Outcome outcome, String externalReference, String evidence) {
        public SubmissionResult {
            if (outcome == null) throw new IllegalArgumentException("provider outcome is required");
        }

        public static SubmissionResult submitted(String externalReference, String evidence) {
            return new SubmissionResult(Outcome.SUBMITTED, externalReference, evidence);
        }

        public static SubmissionResult unknown(String evidence) {
            return new SubmissionResult(Outcome.UNKNOWN, null, evidence);
        }

        public static SubmissionResult failed(String evidence) {
            return new SubmissionResult(Outcome.FAILED, null, evidence);
        }
    }

    enum Outcome {
        SUBMITTED,
        UNKNOWN,
        FAILED
    }
}
