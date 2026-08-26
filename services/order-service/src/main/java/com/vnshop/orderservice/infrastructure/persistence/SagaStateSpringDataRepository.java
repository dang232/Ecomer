package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.saga.SagaStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SagaStateSpringDataRepository extends JpaRepository<SagaStateJpaEntity, String> {
    Optional<SagaStateJpaEntity> findByOrderId(String orderId);
    List<SagaStateJpaEntity> findByCurrentStepAndUpdatedAtBefore(SagaStatus currentStep, Instant updatedAt);

    @Query("select min(s.updatedAt) from SagaStateJpaEntity s where s.currentStep = :status")
    Optional<Instant> findOldestUpdatedAtByCurrentStep(@org.springframework.data.repository.query.Param("status") SagaStatus status);

    long countByCurrentStep(SagaStatus status);
}
