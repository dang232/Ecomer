package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.domain.coupon.Coupon;
import com.vnshop.orderservice.domain.coupon.DiscountType;
import java.math.BigDecimal;
import java.time.ZoneOffset;

public record CouponResponse(
        String id,
        String code,
        String type,
        BigDecimal value,
        BigDecimal minOrderValue,
        BigDecimal maxDiscount,
        int maxUses,
        int currentUses,
        boolean active,
        java.time.Instant validFrom,
        java.time.Instant validUntil) {

    static CouponResponse from(Coupon coupon) {
        return new CouponResponse(
                coupon.id().value().toString(), coupon.code(), wireType(coupon.discountType()),
                coupon.discountValue(), coupon.minOrderAmount().amount(),
                coupon.maxDiscount() == null ? null : coupon.maxDiscount().amount(),
                coupon.totalLimit(), coupon.totalUsed(), coupon.active(),
                coupon.validFrom().toInstant(ZoneOffset.UTC),
                coupon.validUntil().toInstant(ZoneOffset.UTC));
    }

    private static String wireType(DiscountType type) {
        return type == DiscountType.PERCENTAGE ? "PERCENT" : type.name();
    }
}
