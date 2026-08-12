package com.vnshop.paymentservice.infrastructure.persistence;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PendingWebhookSpringDataRepository extends JpaRepository<PendingWebhookJpaEntity, UUID> {

    @Query("""
            SELECT e FROM PendingWebhookJpaEntity e
            WHERE (e.status = 'PENDING'
                     AND (e.nextRetryAt IS NULL OR e.nextRetryAt <= :now))
               OR (e.status = 'PROCESSING' AND e.nextRetryAt <= :now)
            ORDER BY e.createdAt ASC
            """)
    List<PendingWebhookJpaEntity> findRetryable(@Param("now") Instant now, Pageable pageable);

    @Modifying
    @Query("update PendingWebhookJpaEntity e set e.status = 'PROCESSING', "
            + "e.nextRetryAt = :leaseUntil, e.leaseToken = :leaseToken "
            + "where e.id = :id and ((e.status = 'PENDING' and "
            + "(e.nextRetryAt is null or e.nextRetryAt <= :now)) or "
            + "(e.status = 'PROCESSING' and e.nextRetryAt <= :now))")
    int claim(
            @Param("id") UUID id,
            @Param("now") Instant now,
            @Param("leaseUntil") Instant leaseUntil,
            @Param("leaseToken") UUID leaseToken);

    @Modifying
    @Query("update PendingWebhookJpaEntity e set e.status = 'PROCESSED', e.leaseToken = null "
            + "where e.id = :id and e.status = 'PROCESSING' and e.leaseToken = :leaseToken")
    int markProcessed(@Param("id") UUID id, @Param("leaseToken") UUID leaseToken);

    @Modifying
    @Query("update PendingWebhookJpaEntity e set e.attempts = :attempts, "
            + "e.status = :status, e.nextRetryAt = :nextRetryAt, e.leaseToken = null "
            + "where e.id = :id and e.status = 'PROCESSING' and e.leaseToken = :leaseToken")
    int recordFailure(
            @Param("id") UUID id,
            @Param("leaseToken") UUID leaseToken,
            @Param("attempts") int attempts,
            @Param("status") String status,
            @Param("nextRetryAt") Instant nextRetryAt);

    @Modifying
    @Query(value = """
            INSERT INTO payment_svc.pending_webhooks
                (webhook_id, provider, event_type, payload, next_retry_at, status)
            VALUES (:webhookId, :provider, :eventType, :payload, :nextRetryAt, 'PENDING')
            ON CONFLICT (webhook_id, provider) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(
            @Param("webhookId") String webhookId,
            @Param("provider") String provider,
            @Param("eventType") String eventType,
            @Param("payload") String payload,
            @Param("nextRetryAt") Instant nextRetryAt);
}
