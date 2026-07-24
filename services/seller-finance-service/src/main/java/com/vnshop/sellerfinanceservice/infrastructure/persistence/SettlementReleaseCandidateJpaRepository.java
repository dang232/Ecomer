package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.FinancialAdjustment;
import com.vnshop.sellerfinanceservice.domain.SettlementReleaseCandidate;
import com.vnshop.sellerfinanceservice.domain.port.out.SettlementReleaseCandidateRepositoryPort;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class SettlementReleaseCandidateJpaRepository implements SettlementReleaseCandidateRepositoryPort {
    private final ObjectProvider<EntityManager> entityManagerProvider;

    public SettlementReleaseCandidateJpaRepository(ObjectProvider<EntityManager> entityManagerProvider) {
        this.entityManagerProvider = entityManagerProvider;
    }

    @Override
    @Transactional
    public void recordAdjustment(FinancialAdjustment adjustment) {
        EntityManager entityManager = entityManager();
        SettlementReleaseCandidateJpaEntity entity = entityManager.find(
                SettlementReleaseCandidateJpaEntity.class, adjustment.allocationId(), LockModeType.PESSIMISTIC_WRITE);
        if (adjustment.adjustmentType() == FinancialAdjustment.AdjustmentType.CREDIT) {
            if (entity == null) {
                entityManager.persist(SettlementReleaseCandidateJpaEntity.fromCredit(adjustment));
            }
            return;
        }
        if (entity != null) {
            entity.applyHold(adjustment.adjustmentType());
        }
    }

    @Override
    @Transactional
    public void markDelivered(UUID orderId, long subOrderId, Instant deliveredAt) {
        entityManager().createQuery("""
                select candidate from SettlementReleaseCandidateJpaEntity candidate
                where candidate.orderId = :orderId and candidate.subOrderId = :subOrderId
                """, SettlementReleaseCandidateJpaEntity.class)
                .setParameter("orderId", orderId)
                .setParameter("subOrderId", subOrderId)
                .getResultList()
                .forEach(candidate -> candidate.markDelivered(deliveredAt));
    }

    @Override
    @Transactional
    public void updateHold(UUID orderId, Long subOrderId, String holdType, boolean open) {
        EntityManager entityManager = entityManager();
        String query = subOrderId == null
                ? "select candidate from SettlementReleaseCandidateJpaEntity candidate where candidate.orderId = :orderId"
                : "select candidate from SettlementReleaseCandidateJpaEntity candidate where candidate.orderId = :orderId and candidate.subOrderId = :subOrderId";
        var candidates = entityManager.createQuery(query, SettlementReleaseCandidateJpaEntity.class)
                .setParameter("orderId", orderId);
        if (subOrderId != null) candidates.setParameter("subOrderId", subOrderId);
        candidates.getResultList().forEach(candidate -> candidate.updateHold(holdType, open));
    }

    @Override
    @Transactional
    public List<SettlementReleaseCandidate> lockEligible(Instant asOf, int batchSize) {
        if (batchSize < 1) throw new IllegalArgumentException("batchSize must be positive");
        return entityManager().createQuery("""
                select candidate from SettlementReleaseCandidateJpaEntity candidate
                where candidate.releaseStatus = :pending
                  and candidate.deliveredAt is not null
                  and candidate.deliveredAt <= :cutoff
                  and candidate.returnHold = false
                  and candidate.disputeHold = false
                  and candidate.fraudHold = false
                  and candidate.chargebackHold = false
                order by candidate.deliveredAt, candidate.allocationId
                """, SettlementReleaseCandidateJpaEntity.class)
                .setParameter("pending", SettlementReleaseCandidate.ReleaseStatus.PENDING)
                .setParameter("cutoff", asOf.minus(java.time.Duration.ofDays(7)))
                .setMaxResults(batchSize)
                .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                // Hibernate maps the JPA lock timeout -2 to SKIP LOCKED.
                .setHint("jakarta.persistence.lock.timeout", -2)
                .getResultList()
                .stream()
                .map(SettlementReleaseCandidateJpaEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional
    public void markReleased(UUID allocationId, UUID releaseOperationId, Instant releasedAt) {
        SettlementReleaseCandidateJpaEntity entity = entityManager().find(
                SettlementReleaseCandidateJpaEntity.class, allocationId, LockModeType.PESSIMISTIC_WRITE);
        if (entity == null) throw new IllegalStateException("settlement candidate was not found");
        entity.markReleased(releaseOperationId, releasedAt);
    }

    private EntityManager entityManager() {
        EntityManager entityManager = entityManagerProvider.getIfAvailable();
        if (entityManager == null) {
            throw new IllegalStateException("settlement release persistence is unavailable without JPA");
        }
        return entityManager;
    }
}
