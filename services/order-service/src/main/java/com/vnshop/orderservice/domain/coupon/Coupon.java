package com.vnshop.orderservice.domain.coupon;

import com.vnshop.orderservice.domain.Money;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Coupon domain entity. Tracks discount rules and usage counts.
 */
public class Coupon {

    private final CouponId id;
    private final String code;
    private final DiscountType discountType;
    private final BigDecimal discountValue;
    private final Money maxDiscount;
    private final Money minOrderAmount;
    private final int totalLimit;
    private final int perUserLimit;
    private final LocalDateTime validFrom;
    private final LocalDateTime validUntil;

    private int totalUsed;
    private boolean active;

    private Coupon(
            CouponId id,
            String code,
            DiscountType discountType,
            BigDecimal discountValue,
            Money maxDiscount,
            Money minOrderAmount,
            int totalLimit,
            int perUserLimit,
            LocalDateTime validFrom,
            LocalDateTime validUntil
    ) {
        this.id = Objects.requireNonNull(id, "id is required");
        this.code = normalizeCode(code);
        this.discountType = Objects.requireNonNull(discountType, "discountType is required");
        this.discountValue = Objects.requireNonNull(discountValue, "discountValue is required");
        this.maxDiscount = maxDiscount;
        this.minOrderAmount = Objects.requireNonNull(minOrderAmount, "minOrderAmount is required");
        this.totalLimit = totalLimit;
        this.perUserLimit = perUserLimit;
        this.validFrom = Objects.requireNonNull(validFrom, "validFrom is required");
        this.validUntil = Objects.requireNonNull(validUntil, "validUntil is required");
        this.totalUsed = 0;
        this.active = true;
    }

    public static Coupon create(
            CouponId id,
            String code,
            DiscountType discountType,
            BigDecimal discountValue,
            Money maxDiscount,
            Money minOrderAmount,
            int totalLimit,
            int perUserLimit,
            LocalDateTime validFrom,
            LocalDateTime validUntil
    ) {
        if (discountType == DiscountType.PERCENTAGE
                && (discountValue.compareTo(BigDecimal.ZERO) < 0 || discountValue.compareTo(BigDecimal.valueOf(100)) > 0)) {
            throw new IllegalArgumentException("percentage discount must be between 0 and 100");
        }
        if (validUntil.isBefore(validFrom)) {
            throw new IllegalArgumentException("validUntil must not be before validFrom");
        }
        if (totalLimit <= 0) {
            throw new IllegalArgumentException("totalLimit must be positive");
        }
        if (perUserLimit <= 0) {
            throw new IllegalArgumentException("perUserLimit must be positive");
        }
        return new Coupon(id, code, discountType, discountValue, maxDiscount, minOrderAmount,
                totalLimit, perUserLimit, validFrom, validUntil);
    }

    public static Coupon restore(
            CouponId id,
            String code,
            DiscountType discountType,
            BigDecimal discountValue,
            Money maxDiscount,
            Money minOrderAmount,
            int totalLimit,
            int totalUsed,
            int perUserLimit,
            LocalDateTime validFrom,
            LocalDateTime validUntil,
            boolean active) {
        Coupon coupon = create(id, code, discountType, discountValue, maxDiscount, minOrderAmount,
                totalLimit, perUserLimit, validFrom, validUntil);
        if (totalUsed < 0 || totalUsed > totalLimit) {
            throw new IllegalArgumentException("totalUsed must be between zero and totalLimit");
        }
        coupon.totalUsed = totalUsed;
        coupon.active = active;
        return coupon;
    }

    public Coupon replaceTerms(
            String replacementCode,
            DiscountType replacementType,
            BigDecimal replacementValue,
            Money replacementMaxDiscount,
            Money replacementMinOrderAmount,
            int replacementTotalLimit,
            int replacementPerUserLimit,
            LocalDateTime replacementValidFrom,
            LocalDateTime replacementValidUntil) {
        if (replacementTotalLimit < totalUsed) {
            throw new IllegalArgumentException("totalLimit cannot be lower than totalUsed");
        }
        return restore(id, replacementCode, replacementType, replacementValue, replacementMaxDiscount,
                replacementMinOrderAmount, replacementTotalLimit, totalUsed, replacementPerUserLimit,
                replacementValidFrom, replacementValidUntil, active);
    }

    public CouponId id() { return id; }
    public String code() { return code; }
    public DiscountType discountType() { return discountType; }
    public BigDecimal discountValue() { return discountValue; }
    public Money maxDiscount() { return maxDiscount; }
    public Money minOrderAmount() { return minOrderAmount; }
    public int totalLimit() { return totalLimit; }
    public int perUserLimit() { return perUserLimit; }
    public LocalDateTime validFrom() { return validFrom; }
    public LocalDateTime validUntil() { return validUntil; }
    public int totalUsed() { return totalUsed; }
    public boolean active() { return active; }

    public void deactivate() {
        this.active = false;
    }

    public void recordUsage() {
        this.totalUsed++;
    }

    public void releaseUsage() {
        if (this.totalUsed > 0) {
            this.totalUsed--;
        }
    }

    /**
     * Returns true if this coupon passes all validity checks for the given order total,
     * per-user usage count, and point in time.
     */
    public boolean isValid(Money orderTotal, int userUsageCount, LocalDateTime at) {
        return invalidCode(orderTotal, userUsageCount, at) == null;
    }

    /**
     * Returns the error code string if invalid, or null if valid.
     */
    public String invalidCode(Money orderTotal, int userUsageCount, LocalDateTime at) {
        if (!active) return "COUPON_INACTIVE";
        if (at.isAfter(validUntil)) return "COUPON_EXPIRED";
        if (totalUsed >= totalLimit) return "COUPON_EXHAUSTED";
        if (userUsageCount >= perUserLimit) return "COUPON_USER_LIMIT";
        if (orderTotal.amount().compareTo(minOrderAmount.amount()) < 0) return "COUPON_MIN_ORDER";
        return null;
    }

    /**
     * Calculates the discount amount for the given order total.
     * Returns {@link Money#ZERO} for FREE_SHIPPING coupons (handled separately).
     */
    public Money calculateDiscount(Money orderTotal) {
        return switch (discountType) {
            case PERCENTAGE -> {
                BigDecimal raw = orderTotal.amount()
                        .multiply(discountValue)
                        .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
                if (maxDiscount != null && raw.compareTo(maxDiscount.amount()) > 0) {
                    raw = maxDiscount.amount();
                }
                yield new Money(raw, orderTotal.currency());
            }
            case FIXED -> {
                BigDecimal discount = discountValue.min(orderTotal.amount());
                yield new Money(discount, orderTotal.currency());
            }
            case FREE_SHIPPING -> Money.ZERO;
        };
    }

    private static String normalizeCode(String code) {
        Objects.requireNonNull(code, "code is required");
        return code.trim().toUpperCase().replaceAll("\\s+", "");
    }
}
