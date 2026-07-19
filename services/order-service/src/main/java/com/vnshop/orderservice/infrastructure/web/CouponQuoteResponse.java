package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.coupon.CouponQuote;
import java.math.BigDecimal;

public record CouponQuoteResponse(String code, BigDecimal discount, BigDecimal finalTotal) {
    static CouponQuoteResponse from(CouponQuote quote) {
        return new CouponQuoteResponse(
                quote.code(), quote.discount().amount(), quote.finalTotal().amount());
    }
}
