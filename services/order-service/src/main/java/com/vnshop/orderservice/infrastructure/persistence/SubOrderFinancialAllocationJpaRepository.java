package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.domain.port.out.SubOrderFinancialAllocationRepositoryPort;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class SubOrderFinancialAllocationJpaRepository implements SubOrderFinancialAllocationRepositoryPort {
    private final EntityManager entityManager;

    public SubOrderFinancialAllocationJpaRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    public void saveAll(List<SubOrderFinancialAllocation> allocations) {
        allocations.forEach(allocation -> entityManager.persist(SubOrderFinancialAllocationJpaEntity.fromDomain(allocation)));
    }

    @Override
    public List<SubOrderFinancialAllocation> findByOrderId(UUID orderId) {
        return entityManager.createQuery("""
                        select allocation from SubOrderFinancialAllocationJpaEntity allocation
                        where allocation.orderId = :orderId
                        order by allocation.subOrderId, allocation.allocationVersion
                        """, SubOrderFinancialAllocationJpaEntity.class)
                .setParameter("orderId", orderId)
                .getResultList()
                .stream()
                .map(SubOrderFinancialAllocationJpaEntity::toDomain)
                .toList();
    }
}
