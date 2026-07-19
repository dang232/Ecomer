package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.coupon.Coupon;
import com.vnshop.orderservice.domain.coupon.CouponId;
import com.vnshop.orderservice.domain.coupon.DiscountType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(schema = "order_svc", name = "coupons")
@Getter
@Setter
public class CouponJpaEntity extends BaseJpaEntity {
    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "legacy_id", unique = true)
    private Long legacyId;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(name = "type", nullable = false)
    private String discountType;

    @Column(name = "value", nullable = false, precision = 19, scale = 0)
    private BigDecimal discountValue;

    @Column(name = "max_discount_amount", precision = 19, scale = 0)
    private BigDecimal maxDiscountAmount;

    @Column(name = "min_order_value_amount", nullable = false, precision = 19, scale = 0)
    private BigDecimal minOrderAmount;

    @Column(name = "total_usage_limit", nullable = false)
    private int totalLimit;

    @Column(name = "total_used", nullable = false)
    private int totalUsed;

    @Column(name = "per_user_limit", nullable = false)
    private int perUserLimit;

    @Column(name = "valid_from", nullable = false)
    private LocalDateTime validFrom;

    @Column(name = "valid_until", nullable = false)
    private LocalDateTime validUntil;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "coupon_created_at", nullable = false)
    private LocalDateTime couponCreatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    protected CouponJpaEntity() {}

    static CouponJpaEntity fromDomain(Coupon coupon, CouponJpaEntity existing) {
        CouponJpaEntity entity = existing == null ? new CouponJpaEntity() : existing;
        entity.id = coupon.id().value();
        entity.code = coupon.code();
        entity.discountType = coupon.discountType().name();
        entity.discountValue = coupon.discountValue();
        entity.maxDiscountAmount = coupon.maxDiscount() == null ? null : coupon.maxDiscount().amount();
        entity.minOrderAmount = coupon.minOrderAmount().amount();
        entity.totalLimit = coupon.totalLimit();
        entity.totalUsed = coupon.totalUsed();
        entity.perUserLimit = coupon.perUserLimit();
        entity.validFrom = coupon.validFrom();
        entity.validUntil = coupon.validUntil();
        entity.active = coupon.active();
        if (entity.couponCreatedAt == null) entity.couponCreatedAt = coupon.validFrom();
        return entity;
    }

    Coupon toDomain() {
        return Coupon.restore(
                CouponId.of(id), code, DiscountType.valueOf(discountType), discountValue,
                maxDiscountAmount == null ? null : new Money(maxDiscountAmount),
                new Money(minOrderAmount), totalLimit, totalUsed, perUserLimit,
                validFrom, validUntil, active);
    }
}
