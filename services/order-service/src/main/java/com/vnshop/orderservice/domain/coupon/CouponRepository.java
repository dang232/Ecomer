package com.vnshop.orderservice.domain.coupon;

import java.util.List;
import java.util.Optional;

public interface CouponRepository {
    Optional<Coupon> findByCode(String code);

    default Optional<Coupon> findByCodeForUpdate(String code) {
        return findByCode(code);
    }

    default Optional<Coupon> findById(CouponId id) {
        return Optional.empty();
    }

    default Optional<Coupon> findByIdForUpdate(CouponId id) {
        return findById(id);
    }

    default Optional<Coupon> findByLegacyId(long legacyId) {
        return Optional.empty();
    }

    default Coupon save(Coupon coupon) {
        throw new UnsupportedOperationException("coupon persistence is not configured");
    }

    default List<Coupon> findAll() {
        return List.of();
    }
}
