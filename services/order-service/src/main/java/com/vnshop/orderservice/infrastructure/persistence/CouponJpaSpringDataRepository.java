package com.vnshop.orderservice.infrastructure.persistence;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CouponJpaSpringDataRepository extends JpaRepository<CouponJpaEntity, UUID> {
    Optional<CouponJpaEntity> findByCode(String code);

    Optional<CouponJpaEntity> findByLegacyId(Long legacyId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select coupon from CouponJpaEntity coupon where coupon.code = :code")
    Optional<CouponJpaEntity> findByCodeForUpdate(@Param("code") String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select coupon from CouponJpaEntity coupon where coupon.id = :id")
    Optional<CouponJpaEntity> findByIdForUpdate(@Param("id") UUID id);
}
