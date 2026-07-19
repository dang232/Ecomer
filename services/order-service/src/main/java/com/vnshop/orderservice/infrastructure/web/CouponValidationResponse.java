package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.coupon.CouponQuote;
import java.math.BigDecimal;

public record CouponValidationResponse(boolean valid, BigDecimal discount, String message) {
    static CouponValidationResponse from(CouponQuote quote) {
        return new CouponValidationResponse(
                quote.valid(), quote.discount().amount(), quote.reasonCode());
    }
}
