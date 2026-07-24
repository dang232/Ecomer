package com.vnshop.paymentservice.infrastructure.persistence;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface FinancialEventOutboxSpringDataRepository extends JpaRepository<FinancialEventOutboxJpaEntity, Long> {
    @Query("""
            select e from FinancialEventOutboxJpaEntity e
            where e.publishedAt is null
              and e.dead = false
              and (e.nextAttemptAt is null or e.nextAttemptAt <= :now)
            order by e.createdAt asc
            """)
    List<FinancialEventOutboxJpaEntity> findRetryable(@Param("now") Instant now, PageRequest page);
}
