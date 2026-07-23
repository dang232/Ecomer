package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Dispute;
import java.time.Instant;

/** Operator-facing dispute projection assembled by order-service. */
public record EnrichedDispute(
        Dispute dispute,
        String orderId,
        String orderNumber,
        String buyerId,
        String buyerName,
        String sellerId,
        String sellerName,
        Instant createdAt) {
}
