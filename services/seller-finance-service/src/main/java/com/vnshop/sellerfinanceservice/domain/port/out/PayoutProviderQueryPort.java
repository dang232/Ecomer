package com.vnshop.sellerfinanceservice.domain.port.out;

import com.vnshop.sellerfinanceservice.domain.Payout;

/** Provider-side reconciliation used to resolve an ambiguous submission. */
@FunctionalInterface
public interface PayoutProviderQueryPort {
    QueryResult query(Payout payout);

    record QueryResult(Outcome outcome, String externalReference, String evidence) {
        public static QueryResult paid(String externalReference, String evidence) {
            return new QueryResult(Outcome.PAID, externalReference, evidence);
        }

        public static QueryResult failed(String evidence) {
            return new QueryResult(Outcome.FAILED, null, evidence);
        }

        public static QueryResult unknown(String evidence) {
            return new QueryResult(Outcome.UNKNOWN, null, evidence);
        }
    }

    enum Outcome { PAID, FAILED, UNKNOWN }
}
