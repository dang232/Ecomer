package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

interface PaymentJpaSpringDataRepository extends JpaRepository<PaymentJpaEntity, UUID> {
    Optional<PaymentJpaEntity> findByOrderId(String orderId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PaymentJpaEntity p where p.orderId = :orderId")
    Optional<PaymentJpaEntity> findByOrderIdForUpdate(@Param("orderId") String orderId);

    List<PaymentJpaEntity> findByStatus(PaymentStatus status);

    List<PaymentJpaEntity> findByMethodAndStatusAndCreatedAtBefore(PaymentMethod method, PaymentStatus status, Instant before);
}
