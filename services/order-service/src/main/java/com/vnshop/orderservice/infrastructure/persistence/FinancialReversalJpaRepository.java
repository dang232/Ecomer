package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.finance.FinancialReversal;
import com.vnshop.orderservice.domain.port.out.FinancialReversalRepositoryPort;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class FinancialReversalJpaRepository implements FinancialReversalRepositoryPort {
    private final EntityManager entityManager;

    public FinancialReversalJpaRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    @Transactional
    public FinancialReversal reserve(FinancialReversal reversal, BigDecimal allocationBuyerPaidAmount) {
        if (allocationBuyerPaidAmount == null || allocationBuyerPaidAmount.signum() <= 0) {
            throw new IllegalArgumentException("allocationBuyerPaidAmount must be positive");
        }

        FinancialReversalJpaEntity existing = findEntity(reversal.reversalId(), reversal.allocationId());
        if (existing != null) {
            if (existing.toDomain().buyerAmount().compareTo(reversal.buyerAmount()) != 0
                    || existing.toDomain().reversalType() != reversal.reversalType()) {
                throw new IllegalStateException("reversal operation was reused with different allocation facts");
            }
            return existing.toDomain();
        }

        entityManager.createNativeQuery("""
                SELECT allocation_id
                FROM order_svc.sub_order_financial_allocations
                WHERE allocation_id = :allocationId
                FOR UPDATE
                """)
                .setParameter("allocationId", reversal.allocationId())
                .getResultList();

        BigDecimal active = activeAmount(reversal.allocationId());
        if (active.add(reversal.buyerAmount()).compareTo(allocationBuyerPaidAmount) > 0) {
            throw new IllegalStateException("financial reversal exceeds remaining allocation");
        }
        entityManager.persist(FinancialReversalJpaEntity.fromDomain(reversal));
        return reversal;
    }

    @Override
    public BigDecimal remainingBuyerAmount(UUID allocationId, BigDecimal allocationBuyerPaidAmount) {
        return allocationBuyerPaidAmount.subtract(activeAmount(allocationId)).max(BigDecimal.ZERO);
    }

    @Override
    public List<FinancialReversal> findByReversalId(UUID reversalId) {
        return entityManager.createQuery("""
                select reversal from FinancialReversalJpaEntity reversal
                where reversal.reversalId = :reversalId
                order by reversal.allocationId
                """, FinancialReversalJpaEntity.class)
                .setParameter("reversalId", reversalId)
                .getResultList()
                .stream()
                .map(FinancialReversalJpaEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional
    public FinancialReversal resolve(UUID reversalId, UUID allocationId, FinancialReversal.ReversalStatus status) {
        FinancialReversalJpaEntity entity = entityManager.createQuery("""
                select reversal from FinancialReversalJpaEntity reversal
                where reversal.reversalId = :reversalId and reversal.allocationId = :allocationId
                """, FinancialReversalJpaEntity.class)
                .setParameter("reversalId", reversalId)
                .setParameter("allocationId", allocationId)
                .setLockMode(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
                .getResultStream()
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("chargeback reservation was not found"));
        entity.resolve(status);
        return entity.toDomain();
    }

    private BigDecimal activeAmount(UUID allocationId) {
        return (BigDecimal) entityManager.createQuery("""
                select coalesce(sum(reversal.buyerAmount), 0)
                from FinancialReversalJpaEntity reversal
                where reversal.allocationId = :allocationId
                  and reversal.status in (:open, :finalized)
                """)
                .setParameter("allocationId", allocationId)
                .setParameter("open", FinancialReversal.ReversalStatus.OPEN)
                .setParameter("finalized", FinancialReversal.ReversalStatus.FINALIZED)
                .getSingleResult();
    }

    private FinancialReversalJpaEntity findEntity(UUID reversalId, UUID allocationId) {
        return entityManager.createQuery("""
                select reversal from FinancialReversalJpaEntity reversal
                where reversal.reversalId = :reversalId and reversal.allocationId = :allocationId
                """, FinancialReversalJpaEntity.class)
                .setParameter("reversalId", reversalId)
                .setParameter("allocationId", allocationId)
                .getResultStream()
                .findFirst()
                .orElse(null);
    }
}
