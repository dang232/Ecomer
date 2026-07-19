package com.vnshop.orderservice.application.coupon;

import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.coupon.Coupon;
import com.vnshop.orderservice.domain.coupon.CouponException;
import com.vnshop.orderservice.domain.coupon.CouponRepository;
import com.vnshop.orderservice.domain.coupon.CouponUsage;
import com.vnshop.orderservice.domain.coupon.CouponUsageRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public class CouponRedemptionService {
    private final CouponRepository coupons;
    private final CouponUsageRepository usages;
    private final Clock clock;

    public CouponRedemptionService(CouponRepository coupons, CouponUsageRepository usages, Clock clock) {
        this.coupons = Objects.requireNonNull(coupons, "coupons is required");
        this.usages = Objects.requireNonNull(usages, "usages is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    @Transactional(readOnly = true)
    public CouponQuote quote(String rawCode, Money orderTotal, String userId) {
        String code = normalize(rawCode);
        Coupon coupon = coupons.findByCode(code).orElse(null);
        if (coupon == null) return CouponQuote.invalid(code, orderTotal, "COUPON_NOT_FOUND");
        int userUsage = userId == null || userId.isBlank()
                ? 0
                : usages.getUsageCount(coupon.id(), userId);
        String invalidCode = coupon.invalidCode(orderTotal, userUsage, now());
        if (invalidCode != null) return CouponQuote.invalid(code, orderTotal, invalidCode);
        return CouponQuote.valid(code, orderTotal, coupon.calculateDiscount(orderTotal));
    }

    @Transactional
    public Money consume(String rawCode, Money orderTotal, String userId, UUID orderId) {
        requireUser(userId);
        Objects.requireNonNull(orderId, "orderId is required");
        var existing = usages.findByOrderIdForUpdate(orderId);
        if (existing.isPresent()) {
            CouponUsage usage = existing.get();
            if (!usage.consumed()) {
                throw new CouponException("COUPON_RELEASED", "Coupon usage was already released");
            }
            Coupon coupon = coupons.findByIdForUpdate(usage.couponId())
                    .orElseThrow(() -> new CouponException("COUPON_NOT_FOUND", "Coupon not found"));
            return coupon.calculateDiscount(orderTotal);
        }

        String code = normalize(rawCode);
        Coupon coupon = coupons.findByCodeForUpdate(code)
                .orElseThrow(() -> new CouponException("COUPON_NOT_FOUND", "Coupon not found: " + code));
        int userUsage = usages.getUsageCount(coupon.id(), userId);
        String invalidCode = coupon.invalidCode(orderTotal, userUsage, now());
        if (invalidCode != null) throw new CouponException(invalidCode, "Coupon cannot be consumed");

        Money discount = coupon.calculateDiscount(orderTotal);
        coupon.recordUsage();
        coupons.save(coupon);
        usages.save(CouponUsage.consumed(coupon.id(), userId, orderId, clock.instant()));
        return discount;
    }

    @Transactional
    public boolean release(UUID orderId) {
        Objects.requireNonNull(orderId, "orderId is required");
        CouponUsage usage = usages.findByOrderIdForUpdate(orderId).orElse(null);
        if (usage == null || !usage.release(clock.instant())) return false;
        Coupon coupon = coupons.findByIdForUpdate(usage.couponId())
                .orElseThrow(() -> new CouponException("COUPON_NOT_FOUND", "Coupon not found"));
        coupon.releaseUsage();
        coupons.save(coupon);
        usages.save(usage);
        return true;
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), clock.getZone());
    }

    private static String normalize(String code) {
        return code == null ? "" : code.trim().toUpperCase().replaceAll("\\s+", "");
    }

    private static void requireUser(String userId) {
        if (userId == null || userId.isBlank()) throw new IllegalArgumentException("userId is required");
    }
}
