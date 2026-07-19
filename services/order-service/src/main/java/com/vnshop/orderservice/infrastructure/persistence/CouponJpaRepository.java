package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.coupon.Coupon;
import com.vnshop.orderservice.domain.coupon.CouponId;
import com.vnshop.orderservice.domain.coupon.CouponRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class CouponJpaRepository implements CouponRepository {
    private final CouponJpaSpringDataRepository repository;

    public CouponJpaRepository(CouponJpaSpringDataRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<Coupon> findByCode(String code) {
        return repository.findByCode(normalize(code)).map(CouponJpaEntity::toDomain);
    }

    @Override
    public Optional<Coupon> findByCodeForUpdate(String code) {
        return repository.findByCodeForUpdate(normalize(code)).map(CouponJpaEntity::toDomain);
    }

    @Override
    public Optional<Coupon> findById(CouponId id) {
        return repository.findById(id.value()).map(CouponJpaEntity::toDomain);
    }

    @Override
    public Optional<Coupon> findByIdForUpdate(CouponId id) {
        return repository.findByIdForUpdate(id.value()).map(CouponJpaEntity::toDomain);
    }

    @Override
    public Optional<Coupon> findByLegacyId(long legacyId) {
        return repository.findByLegacyId(legacyId).map(CouponJpaEntity::toDomain);
    }

    @Override
    public Coupon save(Coupon coupon) {
        CouponJpaEntity existing = repository.findById(coupon.id().value()).orElse(null);
        return repository.save(CouponJpaEntity.fromDomain(coupon, existing)).toDomain();
    }

    @Override
    public List<Coupon> findAll() {
        return repository.findAll().stream().map(CouponJpaEntity::toDomain).toList();
    }

    private static String normalize(String code) {
        return code == null ? "" : code.trim().toUpperCase().replaceAll("\\s+", "");
    }
}
