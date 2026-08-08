package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.Payout;
import com.vnshop.sellerfinanceservice.domain.PayoutStatus;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutRepositoryPort;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;

@Repository
public class PayoutJpaRepository implements PayoutRepositoryPort {
    private final PayoutSpringDataRepository repository;

    public PayoutJpaRepository(PayoutSpringDataRepository repository) {
        this.repository = repository;
    }

    @Override
    public Payout save(Payout payout) {
        return repository.save(PayoutJpaEntity.fromDomain(payout)).toDomain();
    }

    @Override
    public Optional<Payout> findById(UUID payoutId) {
        return repository.findById(payoutId).map(PayoutJpaEntity::toDomain);
    }

    @Override
    public Optional<Payout> findBySellerIdAndIdempotencyKey(String sellerId, String idempotencyKey) {
        return repository.findBySellerIdAndIdempotencyKey(sellerId, idempotencyKey).map(PayoutJpaEntity::toDomain);
    }

    @Override
    public List<Payout> findByStatus(PayoutStatus status) {
        return repository.findByStatus(status).stream().map(PayoutJpaEntity::toDomain).toList();
    }

    @Override
    public List<Payout> findAdminCursor(
            String query, PayoutStatus status, Instant beforeCreatedAt, UUID beforePayoutId, int limit) {
        String normalized = query == null ? "" : query.trim().toLowerCase(java.util.Locale.ROOT);
        return repository.findAdminCursor(normalized, "%" + normalized + "%", status,
                        beforeCreatedAt, beforePayoutId, PageRequest.of(0, limit))
                .stream().map(PayoutJpaEntity::toDomain).toList();
    }

    @Override
    public List<Payout> findByStatus(PayoutStatus status, String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase();
        return repository.findByStatusAndQuery(status, normalized, "%" + normalized + "%").stream()
                .map(PayoutJpaEntity::toDomain)
                .toList();
    }

    @Override
    public List<Payout> findCompleted() {
        return repository.findByStatusOrderByCompletedAtDesc(PayoutStatus.COMPLETED).stream()
                .map(PayoutJpaEntity::toDomain)
                .toList();
    }

    @Override
    public List<Payout> findCompleted(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase();
        return repository.findCompletedAndQuery(PayoutStatus.COMPLETED, normalized, "%" + normalized + "%").stream()
                .map(PayoutJpaEntity::toDomain)
                .toList();
    }

    @Override
    public List<Payout> findBySellerId(String sellerId) {
        return repository.findBySellerId(sellerId).stream().map(PayoutJpaEntity::toDomain).toList();
    }
}
