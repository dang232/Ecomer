package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.domain.PaymentIdempotencyKey;
import com.vnshop.paymentservice.domain.port.out.PaymentIdempotencyKeyRepositoryPort;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class PaymentIdempotencyKeyJpaRepository implements PaymentIdempotencyKeyRepositoryPort {
    private final PaymentIdempotencyKeySpringDataRepository springDataRepository;

    public PaymentIdempotencyKeyJpaRepository(PaymentIdempotencyKeySpringDataRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public Optional<PaymentIdempotencyKey> findByKey(String key) {
        return springDataRepository.findById(key).map(PaymentIdempotencyKeyJpaEntity::toDomain);
    }

    @Override
    public void deleteByKey(String key) {
        springDataRepository.deleteById(key);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public boolean claim(PaymentIdempotencyKey key) {
        return springDataRepository.claim(key.key(), key.paymentId(), key.requestHash(), key.createdAt()) == 1;
    }

    @Override
    public boolean supportsAtomicClaim() {
        return true;
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void markCompleted(String key) {
        springDataRepository.markCompleted(key);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public int deleteAbandonedClaims(java.time.Instant before) {
        return springDataRepository.deleteAbandonedClaims(before);
    }


    @Override
    public PaymentIdempotencyKey save(PaymentIdempotencyKey key) {
        return springDataRepository.save(PaymentIdempotencyKeyJpaEntity.fromDomain(key)).toDomain();
    }
}
