package com.vnshop.orderservice.infrastructure.coupon;

import com.vnshop.orderservice.application.coupon.CouponQuote;
import com.vnshop.orderservice.application.coupon.CouponRedemptionService;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.port.out.CouponValidationPort;
import java.math.BigDecimal;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Compatibility adapter for the checkout preview port. Coupon ownership lives
 * in order-service, so preview and place-order share one rule implementation.
 */
@Component
public class CouponServiceAdapter implements CouponValidationPort {
    private final CouponRedemptionService couponRedemptionService;

    public CouponServiceAdapter(CouponRedemptionService couponRedemptionService) {
        this.couponRedemptionService = couponRedemptionService;
    }

    @Override
    public Optional<BigDecimal> resolveDiscount(String code, BigDecimal orderTotal, String userId) {
        if (code == null || code.isBlank() || orderTotal == null || orderTotal.signum() <= 0) {
            return Optional.empty();
        }
        CouponQuote quote = couponRedemptionService.quote(code, new Money(orderTotal), userId);
        return quote.valid() && quote.discount().amount().signum() > 0
                ? Optional.of(quote.discount().amount())
                : Optional.empty();
    }
}
