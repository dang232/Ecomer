package com.vnshop.productservice.domain.review.port.out;

import java.time.Instant;

/**
 * Answers whether a buyer has a delivered purchase for a product.
 *
 * <p>The review use case depends on this boundary instead of calling the
 * order service directly, keeping transaction evidence local and replayable.
 */
public interface PurchaseVerificationPort {
    boolean hasDeliveredPurchase(String buyerId, String productId, String orderId);

    void recordDeliveredPurchase(String orderId, String buyerId, String productId, Instant deliveredAt);
}
