package com.vnshop.orderservice.domain.projection;

import java.math.BigDecimal;
import java.time.Instant;

public record OrderSummaryProjection(
    String orderId,
    String orderNumber,
    String buyerId,
    String sellerId,
    String status,
    BigDecimal totalAmount,
    int itemCount,
    Instant createdAt,
    Instant updatedAt,
    String buyerName,
    String sellerName
) {
    public OrderSummaryProjection(String orderId, String buyerId, String sellerId, String status,
            BigDecimal totalAmount, int itemCount, Instant createdAt, Instant updatedAt) {
        this(orderId, null, buyerId, sellerId, status, totalAmount, itemCount, createdAt, updatedAt, null, null);
    }

    public OrderSummaryProjection(String orderId, String orderNumber, String buyerId, String sellerId, String status,
            BigDecimal totalAmount, int itemCount, Instant createdAt, Instant updatedAt) {
        this(orderId, orderNumber, buyerId, sellerId, status, totalAmount, itemCount, createdAt, updatedAt, null, null);
    }

    public OrderSummaryProjection withDisplayNames(String nextBuyerName, String nextSellerName) {
        return new OrderSummaryProjection(orderId, orderNumber, buyerId, sellerId, status, totalAmount, itemCount,
                createdAt, updatedAt, nextBuyerName, nextSellerName);
    }
}
