package com.vnshop.paymentservice.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface PaymentIdempotencyKeySpringDataRepository extends JpaRepository<PaymentIdempotencyKeyJpaEntity, String> {
    @Modifying
    @Query(value = "INSERT INTO payment_svc.payment_idempotency_keys "
            + "(idempotency_key, payment_id, request_hash, created_at) "
            + "VALUES (:key, :paymentId, :requestHash, :createdAt) "
            + "ON CONFLICT (idempotency_key) DO NOTHING", nativeQuery = true)
    int claim(@Param("key") String key, @Param("paymentId") java.util.UUID paymentId,
              @Param("requestHash") String requestHash, @Param("createdAt") java.time.Instant createdAt);

    @Modifying
    @Query(value = "UPDATE payment_svc.payment_idempotency_keys SET claim_status = 'COMPLETED', lease_until = NULL WHERE idempotency_key = :key", nativeQuery = true)
    int markCompleted(@Param("key") String key);

    @Modifying
    @Query(value = "DELETE FROM payment_svc.payment_idempotency_keys WHERE claim_status = 'CLAIMED' AND lease_until IS NOT NULL AND lease_until < :before", nativeQuery = true)
    int deleteAbandonedClaims(@Param("before") java.time.Instant before);
}
