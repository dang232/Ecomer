package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.coupon.CouponId;
import com.vnshop.orderservice.domain.coupon.CouponUsage;
import com.vnshop.orderservice.domain.coupon.CouponUsageRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class CouponUsageJpaRepository implements CouponUsageRepository {
    private final CouponUsageJpaSpringDataRepository repository;

    public CouponUsageJpaRepository(CouponUsageJpaSpringDataRepository repository) {
        this.repository = repository;
    }

    @Override
    public int getUsageCount(CouponId couponId, String buyerId) {
        return Math.toIntExact(repository.countByCouponIdAndUserIdAndStatus(
                couponId.value(), buyerId, CouponUsage.Status.CONSUMED));
    }

    @Override
    public Optional<CouponUsage> findByOrderIdForUpdate(UUID orderId) {
        return repository.findByOrderIdForUpdate(orderId).map(CouponUsageJpaEntity::toDomain);
    }

    @Override
    public CouponUsage save(CouponUsage usage) {
        CouponUsageJpaEntity existing = repository.findById(usage.id()).orElse(null);
        return repository.save(CouponUsageJpaEntity.fromDomain(usage, existing)).toDomain();
    }
}
