package com.vnshop.productservice.infrastructure.persistence;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductEventOutboxSpringDataRepository extends JpaRepository<ProductEventOutboxJpaEntity, Long> {
    @Query("""
            SELECT e FROM ProductEventOutboxJpaEntity e
            WHERE e.dead = FALSE AND e.publishedAt IS NULL AND e.nextAttemptAt <= :now
            ORDER BY e.createdAt ASC
            """)
    List<ProductEventOutboxJpaEntity> findRetryable(@Param("now") Instant now, Pageable pageable);
}
