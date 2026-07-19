package com.vnshop.orderservice.infrastructure.web;

import java.math.BigDecimal;

public record CouponRequest(
        String code,
        Long orderId,
        String userId,
        BigDecimal orderAmount,
        BigDecimal orderTotal) {

    public BigDecimal effectiveOrderAmount() {
        return orderAmount != null ? orderAmount : orderTotal;
    }
}
