package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.domain.FinancialEventOutboxRecord;
import com.vnshop.paymentservice.domain.port.out.FinancialEventOutboxPort;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class FinancialEventOutboxJpaRepository implements FinancialEventOutboxPort {
    private final FinancialEventOutboxSpringDataRepository repository;

    public FinancialEventOutboxJpaRepository(FinancialEventOutboxSpringDataRepository repository) {
        this.repository = repository;
    }

    @Override
    public FinancialEventOutboxRecord save(FinancialEventOutboxRecord record) {
        return repository.save(FinancialEventOutboxJpaEntity.fromRecord(record)).toRecord();
    }

    @Override
    public List<FinancialEventOutboxRecord> findRetryable(int limit, Instant now) {
        return repository.findRetryable(now, PageRequest.of(0, limit)).stream()
                .map(FinancialEventOutboxJpaEntity::toRecord)
                .toList();
    }

    @Override
    @Transactional
    public void markPublished(Long id, Instant publishedAt) {
        repository.findById(id).ifPresent(entity -> {
            if (entity.getPublishedAt() == null) {
                entity.setPublishedAt(publishedAt);
                repository.save(entity);
            }
        });
    }

    @Override
    @Transactional
    public void recordFailure(Long id, int attemptCount, String error, Instant nextAttemptAt, boolean dead) {
        repository.findById(id).ifPresent(entity -> {
            entity.setAttemptCount(attemptCount);
            entity.setLastError(error);
            entity.setNextAttemptAt(nextAttemptAt);
            entity.setDead(dead);
            repository.save(entity);
        });
    }
}
