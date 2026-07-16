package com.vnshop.couponservice.infrastructure.persistence;

import com.vnshop.couponservice.domain.Coupon;
import com.vnshop.couponservice.domain.port.out.CouponRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * JPA-backed implementation of the domain {@link CouponRepository} port. The
 * application layer depends only on the port; this adapter handles the
 * Hibernate / Spring Data wiring and the entity ⇄ aggregate mapping.
 */
@Component
public class CouponRepositoryAdapter implements CouponRepository {
    private final CouponJpaRepository jpa;

    public CouponRepositoryAdapter(CouponJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public Coupon save(Coupon coupon) {
        CouponJpaEntity existing = (coupon.id() != null)
                ? jpa.findById(coupon.id()).orElse(null)
                : null;
        CouponJpaEntity row = CouponJpaMapper.toRow(coupon, existing);
        return CouponJpaMapper.toDomain(jpa.save(row));
    }

    @Override
    public Optional<Coupon> findById(Long id) {
        return jpa.findById(id).map(CouponJpaMapper::toDomain);
    }

    @Override
    public Optional<Coupon> findByCode(String code) {
        return jpa.findByCode(code).map(CouponJpaMapper::toDomain);
    }

    @Override
    public List<Coupon> findAll() {
        return jpa.findAll().stream().map(CouponJpaMapper::toDomain).toList();
    }

    @Override
    public List<Coupon> findActive() {
        Instant now = Instant.now();
        return jpa.findActiveAt(now).stream().map(CouponJpaMapper::toDomain).toList();
    }

    @Override
    public boolean tryConsumeUsage(Long couponId) {
        return jpa.tryConsumeUsage(couponId) > 0;
    }
}
