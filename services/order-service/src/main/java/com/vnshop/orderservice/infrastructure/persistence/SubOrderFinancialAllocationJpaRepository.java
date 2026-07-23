package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.domain.port.out.SubOrderFinancialAllocationRepositoryPort;
import jakarta.persistence.EntityManager;
import java.util.List;
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
}
