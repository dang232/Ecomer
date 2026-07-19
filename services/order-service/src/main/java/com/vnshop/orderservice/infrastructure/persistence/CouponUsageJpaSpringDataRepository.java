package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.coupon.CouponUsage;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CouponUsageJpaSpringDataRepository extends JpaRepository<CouponUsageJpaEntity, UUID> {
    long countByCouponIdAndUserIdAndStatus(UUID couponId, String userId, CouponUsage.Status status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select usage from CouponUsageJpaEntity usage where usage.orderId = :orderId")
    Optional<CouponUsageJpaEntity> findByOrderIdForUpdate(@Param("orderId") UUID orderId);
}
