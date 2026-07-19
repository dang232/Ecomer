package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.domain.PaymentCallbackOutboxRecord;
import com.vnshop.paymentservice.domain.port.out.PaymentCallbackOutbox;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class PaymentCallbackOutboxJpaRepository implements PaymentCallbackOutbox {
    private final PaymentCallbackOutboxSpringDataRepository springDataRepository;

    public PaymentCallbackOutboxJpaRepository(PaymentCallbackOutboxSpringDataRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public PaymentCallbackOutboxRecord save(PaymentCallbackOutboxRecord record) {
        return springDataRepository.save(PaymentCallbackOutboxJpaEntity.fromRecord(record)).toRecord();
    }

    @Override
    public List<PaymentCallbackOutboxRecord> findUnpublished(int limit) {
        return springDataRepository
                .findByPublishedAtIsNullOrderByCreatedAtAsc(PageRequest.of(0, limit))
                .stream()
                .map(PaymentCallbackOutboxJpaEntity::toRecord)
                .toList();
    }

    @Override
    public List<PaymentCallbackOutboxRecord> findRetryable(int limit) {
        return springDataRepository
                .findRetryable(Instant.now(), PageRequest.of(0, limit))
                .stream()
                .map(PaymentCallbackOutboxJpaEntity::toRecord)
                .toList();
    }

    @Override
    @Transactional
    public void markPublished(Long id) {
        springDataRepository.findById(id).ifPresent(entity -> {
            if (!entity.isPublished()) {
                entity.markPublished(Instant.now());
                springDataRepository.save(entity);
            }
        });
    }

    @Override
    @Transactional
    public void recordFailure(Long id, int attemptCount, String error, Instant nextAttemptAt, boolean dead) {
        springDataRepository.findById(id).ifPresent(entity -> {
            entity.setAttemptCount(attemptCount);
            entity.setLastError(error);
            entity.setNextAttemptAt(nextAttemptAt);
            entity.setDead(dead);
            springDataRepository.save(entity);
        });
    }
}
