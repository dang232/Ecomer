package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.coupon.CouponId;
import com.vnshop.orderservice.domain.coupon.CouponUsage;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(schema = "order_svc", name = "coupon_usages")
@Getter
@Setter
public class CouponUsageJpaEntity extends BaseJpaEntity {
    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "coupon_id", nullable = false, columnDefinition = "uuid")
    private UUID couponId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "order_id", nullable = false, unique = true, columnDefinition = "uuid")
    private UUID orderId;

    @Column(nullable = false)
    private boolean active;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CouponUsage.Status status;

    @Column(name = "released_at")
    private Instant releasedAt;

    protected CouponUsageJpaEntity() {}

    static CouponUsageJpaEntity fromDomain(CouponUsage usage, CouponUsageJpaEntity existing) {
        CouponUsageJpaEntity entity = existing == null ? new CouponUsageJpaEntity() : existing;
        entity.id = usage.id();
        entity.couponId = usage.couponId().value();
        entity.userId = usage.userId();
        entity.orderId = usage.orderId();
        entity.active = usage.consumed();
        entity.status = usage.status();
        entity.releasedAt = usage.releasedAt();
        return entity;
    }

    CouponUsage toDomain() {
        return CouponUsage.restore(
                id, CouponId.of(couponId), userId, orderId, status,
                getCreatedAt(), releasedAt);
    }
}
