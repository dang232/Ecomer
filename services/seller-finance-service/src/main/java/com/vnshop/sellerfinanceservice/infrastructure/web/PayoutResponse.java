package com.vnshop.sellerfinanceservice.infrastructure.web;

import com.vnshop.sellerfinanceservice.domain.Payout;

import java.math.BigDecimal;
import java.time.Instant;

public record PayoutResponse(
        String payoutId,
        String sellerId,
        BigDecimal amount,
        String status,
        Instant createdAt,
        String completedBy,
        Instant completedAt,
        String sellerName) {
    static PayoutResponse fromDomain(Payout payout) {
        return fromDomain(payout, null);
    }

    static PayoutResponse fromDomain(Payout payout, String sellerName) {
        return new PayoutResponse(
                payout.payoutId().toString(),
                payout.sellerId(),
                payout.amount(),
                payout.status().name(),
                payout.createdAt(),
                payout.completedBy(),
                payout.completedAt(),
                sellerName);
    }
}
