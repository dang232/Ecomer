package com.vnshop.orderservice.infrastructure.outbox;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompensationOutboxSpringDataRepository
        extends JpaRepository<CompensationOutboxEventJpaEntity, Long> {
    @Query("select min(e.createdAt) from CompensationOutboxEventJpaEntity e where e.status = com.vnshop.orderservice.infrastructure.outbox.CompensationOutboxEvent$Status.PENDING")
    Optional<Instant> findOldestPendingCreatedAt();

    long countByStatus(CompensationOutboxEvent.Status status);
    @Modifying
    @Query(value = """
        INSERT INTO order_svc.saga_compensation_outbox
            (saga_id, order_id, step, operation_id, topic, payload, status,
             attempt_count, next_attempt_at, created_at, updated_at)
        VALUES (:sagaId, :orderId, :step, :operationId, :topic, CAST(:payload AS jsonb),
                'PENDING', 0, NOW(), NOW(), NOW())
        ON CONFLICT (operation_id) DO NOTHING
        """, nativeQuery = true)
    int insertIfAbsent(
            @Param("sagaId") String sagaId,
            @Param("orderId") String orderId,
            @Param("step") String step,
            @Param("operationId") String operationId,
            @Param("topic") String topic,
            @Param("payload") String payload);

    @Query(value = """
        SELECT id, saga_id, order_id, step, operation_id, topic, payload, status,
               attempt_count, next_attempt_at, last_error, created_at, updated_at
        FROM order_svc.saga_compensation_outbox
        WHERE status = 'PENDING'
          AND next_attempt_at <= :now
        ORDER BY created_at ASC
        LIMIT :batchSize
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    List<CompensationOutboxEventJpaEntity> findAndLockPendingEvents(
            @Param("now") Instant now,
            @Param("batchSize") int batchSize);
}
