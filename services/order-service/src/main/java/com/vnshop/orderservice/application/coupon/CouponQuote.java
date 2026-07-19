package com.vnshop.orderservice.application.coupon;

import com.vnshop.orderservice.domain.Money;

public record CouponQuote(String code, boolean valid, Money discount, Money finalTotal, String reasonCode) {
    public static CouponQuote valid(String code, Money orderTotal, Money discount) {
        return new CouponQuote(code, true, discount, orderTotal.subtract(discount), null);
    }

    public static CouponQuote invalid(String code, Money orderTotal, String reasonCode) {
        return new CouponQuote(code, false, Money.ZERO, orderTotal, reasonCode);
    }
}
