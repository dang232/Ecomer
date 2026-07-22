package com.vnshop.productservice.infrastructure.persistence.review;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRatingProjectionBackfillSpringDataRepository
        extends JpaRepository<ProductRatingProjectionBackfillJpaEntity, Short> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select marker from ProductRatingProjectionBackfillJpaEntity marker where marker.id = :id")
    Optional<ProductRatingProjectionBackfillJpaEntity> findForUpdate(@Param("id") short id);
}
