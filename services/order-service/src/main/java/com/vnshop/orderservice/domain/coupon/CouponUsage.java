package com.vnshop.orderservice.domain.coupon;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public class CouponUsage {
    public enum Status { CONSUMED, RELEASED }

    private final UUID id;
    private final CouponId couponId;
    private final String userId;
    private final UUID orderId;
    private final Instant createdAt;
    private Status status;
    private Instant releasedAt;

    private CouponUsage(
            UUID id,
            CouponId couponId,
            String userId,
            UUID orderId,
            Status status,
            Instant createdAt,
            Instant releasedAt) {
        this.id = Objects.requireNonNull(id, "id is required");
        this.couponId = Objects.requireNonNull(couponId, "couponId is required");
        this.userId = requireNonBlank(userId, "userId");
        this.orderId = Objects.requireNonNull(orderId, "orderId is required");
        this.status = Objects.requireNonNull(status, "status is required");
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt is required");
        this.releasedAt = releasedAt;
    }

    public static CouponUsage consumed(CouponId couponId, String userId, UUID orderId, Instant at) {
        return new CouponUsage(UUID.randomUUID(), couponId, userId, orderId, Status.CONSUMED, at, null);
    }

    public static CouponUsage restore(
            UUID id,
            CouponId couponId,
            String userId,
            UUID orderId,
            Status status,
            Instant createdAt,
            Instant releasedAt) {
        return new CouponUsage(id, couponId, userId, orderId, status, createdAt, releasedAt);
    }

    public boolean release(Instant at) {
        if (status == Status.RELEASED) return false;
        status = Status.RELEASED;
        releasedAt = Objects.requireNonNull(at, "releasedAt is required");
        return true;
    }

    public boolean consumed() { return status == Status.CONSUMED; }
    public UUID id() { return id; }
    public CouponId couponId() { return couponId; }
    public String userId() { return userId; }
    public UUID orderId() { return orderId; }
    public Status status() { return status; }
    public Instant createdAt() { return createdAt; }
    public Instant releasedAt() { return releasedAt; }

    private static String requireNonBlank(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
        return value;
    }
}
