package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.domain.PaymentIdempotencyKey;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;
import java.time.Duration;

@Entity
@Table(schema = "payment_svc", name = "payment_idempotency_keys")
public class PaymentIdempotencyKeyJpaEntity {
    @Id
    @Column(name = "idempotency_key", nullable = false, length = 255)
    private String idempotencyKey;

    @Column(name = "payment_id", nullable = true, columnDefinition = "uuid")
    private UUID paymentId;

    @Column(name = "claim_status", nullable = false, length = 32)
    private String claimStatus;

    @Column(name = "claimed_at", nullable = false)
    private Instant claimedAt;

    @Column(name = "lease_until")
    private Instant leaseUntil;

    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PaymentIdempotencyKeyJpaEntity() {
    }

    public static PaymentIdempotencyKeyJpaEntity fromDomain(PaymentIdempotencyKey domain) {
        PaymentIdempotencyKeyJpaEntity entity = new PaymentIdempotencyKeyJpaEntity();
        entity.idempotencyKey = domain.key();
        entity.paymentId = domain.paymentId();
        entity.requestHash = domain.requestHash();
        entity.createdAt = domain.createdAt();
        entity.claimStatus = "CLAIMED";
        entity.claimedAt = domain.createdAt();
        entity.leaseUntil = domain.createdAt().plus(Duration.ofMinutes(15));
        return entity;
    }

    public PaymentIdempotencyKey toDomain() {
        return new PaymentIdempotencyKey(idempotencyKey, paymentId, requestHash, createdAt);
    }
}
