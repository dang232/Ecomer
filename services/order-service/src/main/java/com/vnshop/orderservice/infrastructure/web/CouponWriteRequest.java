package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.coupon.CouponManagementService.CouponTerms;
import java.math.BigDecimal;
import java.time.Instant;

public record CouponWriteRequest(
        String code,
        String type,
        BigDecimal value,
        BigDecimal minOrderValue,
        BigDecimal maxDiscount,
        int maxUses,
        Integer perUserLimit,
        Instant validFrom,
        Instant validUntil,
        Instant startsAt,
        Instant endsAt) {

    CouponTerms toTerms() {
        return new CouponTerms(
                code, type, value, minOrderValue, maxDiscount, maxUses, perUserLimit,
                validFrom != null ? validFrom : startsAt,
                validUntil != null ? validUntil : endsAt);
    }
}
