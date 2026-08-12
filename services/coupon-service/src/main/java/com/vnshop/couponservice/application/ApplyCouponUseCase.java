package com.vnshop.couponservice.application;

import com.vnshop.couponservice.domain.Coupon;
import com.vnshop.couponservice.domain.port.out.CouponRepository;
import com.vnshop.couponservice.domain.port.out.CouponUsagePort;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import org.springframework.transaction.annotation.Transactional;

/**
 * Apply a coupon to an order. Pre-flight checks (active / expiry / minimum
 * order / per-user usage) read the aggregate state and surface a friendly
 * error; the actual usage decrement is the repository's atomic
 * {@link CouponRepository#tryConsumeUsage} which serialises concurrent
 * applies inside the DB. If two callers race for the last seat, exactly one
 * sees {@code true} and the other sees {@code false} (mapped to
 * {@code COUPON_EXHAUSTED}).
 */
public class ApplyCouponUseCase {
    public static final String CODE_COUPON_EXHAUSTED = "COUPON_EXHAUSTED";

    private final CouponRepository repository;
    private final CouponUsagePort usagePort;

    public ApplyCouponUseCase(CouponRepository repository, CouponUsagePort usagePort) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.usagePort = Objects.requireNonNull(usagePort, "usagePort");
    }

    @Transactional
    public ApplyCouponResult apply(String code, BigDecimal orderAmount, String userId) {
        Objects.requireNonNull(orderAmount, "orderAmount");
        Objects.requireNonNull(userId, "userId");
        Coupon coupon = repository.findByCode(code)
                .orElseThrow(() -> new CouponNotFoundException("Coupon not found"));

        if (!coupon.active()) {
            throw new CouponDomainException("Coupon is inactive");
        }
        if (coupon.validUntil().isBefore(Instant.now())) {
            throw new CouponDomainException("Coupon is expired");
        }
        if (orderAmount.compareTo(coupon.minOrderValue()) < 0) {
            throw new CouponDomainException("Order amount is below minimum");
        }

        // Per-user usage check
        if (usagePort.hasUserUsedCoupon(coupon.id(), userId)) {
            throw new CouponDomainException("Coupon already used by this user");
        }

        boolean consumed = repository.tryConsumeUsage(coupon.id());
        if (!consumed) {
            throw new CouponDomainException(CODE_COUPON_EXHAUSTED + ": Coupon usage limit exceeded");
        }

        // Record per-user usage
        usagePort.recordUsage(coupon.id(), userId);

        BigDecimal discount = coupon.calculateDiscount(orderAmount);
        BigDecimal finalTotal = orderAmount.subtract(discount).max(BigDecimal.ZERO);
        return new ApplyCouponResult(coupon.code(), discount, finalTotal);
    }
}
