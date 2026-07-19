package com.vnshop.orderservice.domain.coupon;

import java.util.Optional;
import java.util.UUID;

public interface CouponUsageRepository {
    int getUsageCount(CouponId couponId, String buyerId);

    Optional<CouponUsage> findByOrderIdForUpdate(UUID orderId);

    CouponUsage save(CouponUsage usage);
}
