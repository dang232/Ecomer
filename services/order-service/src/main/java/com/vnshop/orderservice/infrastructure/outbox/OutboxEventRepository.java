package com.vnshop.orderservice.infrastructure.outbox;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

@Repository
public class OutboxEventRepository {
    private final OutboxEventSpringDataRepository springDataRepository;

    public OutboxEventRepository(OutboxEventSpringDataRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    public OutboxEventJpaEntity save(OutboxEventJpaEntity event) {
        return springDataRepository.save(event);
    }

    public List<OutboxEventJpaEntity> findDuePendingEvents(Instant now, Pageable pageable) {
        return springDataRepository.findByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAt(
                OutboxEvent.Status.PENDING,
                now,
                pageable
        );
    }

    public List<OutboxEventJpaEntity> findAndLockPendingEvents(Instant now, int batchSize) {
        return springDataRepository.findAndLockPendingEvents(now, batchSize);
    }

    public Instant oldestCreatedAt(OutboxEvent.Status status) {
        return springDataRepository.findOldestCreatedAtByStatus(status).orElse(null);
    }

    public long count(OutboxEvent.Status status) {
        return springDataRepository.countByStatus(status);
    }
}
