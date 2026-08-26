package com.vnshop.inventoryservice.infrastructure.persistence;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface ReservationOperationJpaSpringDataRepository
        extends JpaRepository<ReservationOperationJpaEntity, String> {
    Optional<ReservationOperationJpaEntity> findByOperationId(String operationId);
}
