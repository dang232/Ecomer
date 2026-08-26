package com.vnshop.orderservice.infrastructure.outbox;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class CompensationOutboxRepository {
    private final CompensationOutboxSpringDataRepository springDataRepository;

    public CompensationOutboxRepository(CompensationOutboxSpringDataRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    public int insertIfAbsent(CompensationOutboxEventJpaEntity event) {
        return springDataRepository.insertIfAbsent(
                event.getSagaId(), event.getOrderId(), event.getStep(), event.getOperationId(),
                event.getTopic(), event.getPayload());
    }

    public List<CompensationOutboxEventJpaEntity> findAndLockPendingEvents(Instant now, int batchSize) {
        return springDataRepository.findAndLockPendingEvents(now, batchSize);
    }

    public CompensationOutboxEventJpaEntity save(CompensationOutboxEventJpaEntity event) {
        return springDataRepository.save(event);
    }

    public Instant oldestPendingCreatedAt() {
        return springDataRepository.findOldestPendingCreatedAt().orElse(null);
    }

    public long count(CompensationOutboxEvent.Status status) {
        return springDataRepository.countByStatus(status);
    }
}
