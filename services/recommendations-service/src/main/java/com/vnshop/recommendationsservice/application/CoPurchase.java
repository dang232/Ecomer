package com.vnshop.recommendationsservice.application;

import java.time.Instant;

public record CoPurchase(
        String productA,
        String productB,
        long count,
        Instant lastSeenAt
) {
    public CoPurchase incrementedAt(Instant timestamp) {
        return new CoPurchase(productA, productB, count + 1, timestamp);
    }
}
