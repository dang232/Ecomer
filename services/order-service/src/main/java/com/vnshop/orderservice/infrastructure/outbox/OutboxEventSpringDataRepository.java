package com.vnshop.orderservice.infrastructure.outbox;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OutboxEventSpringDataRepository extends JpaRepository<OutboxEventJpaEntity, Long> {
    @Query("select min(e.createdAt) from OutboxEventJpaEntity e where e.status = :status")
    Optional<Instant> findOldestCreatedAtByStatus(@Param("status") OutboxEvent.Status status);

    long countByStatus(OutboxEvent.Status status);
    List<OutboxEventJpaEntity> findByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAt(
            OutboxEvent.Status status,
            Instant nextAttemptAt,
            Pageable pageable
    );

    @Query(value = """
        SELECT id, aggregate_type, aggregate_id, event_type, payload,
               status, next_attempt_at, attempt_count, last_error,
               created_at, updated_at
        FROM outbox_events
        WHERE status = 'PENDING'
        AND (next_attempt_at IS NULL OR next_attempt_at <= :now)
        ORDER BY created_at ASC
        LIMIT :batchSize
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    List<OutboxEventJpaEntity> findAndLockPendingEvents(
            @Param("now") Instant now,
            @Param("batchSize") int batchSize
    );
}
