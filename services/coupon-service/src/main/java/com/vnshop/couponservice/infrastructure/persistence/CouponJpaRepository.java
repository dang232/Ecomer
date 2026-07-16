package com.vnshop.couponservice.infrastructure.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * Spring Data interface — internal to the persistence adapter. The
 * application talks to {@link com.vnshop.couponservice.domain.port.out.CouponRepository}
 * (the domain port); this interface is the JPA-flavoured backing for that port.
 */
public interface CouponJpaRepository extends JpaRepository<CouponJpaEntity, Long> {
    Optional<CouponJpaEntity> findByCode(String code);

    @Query("select c from CouponJpaEntity c "
            + "where c.active = true "
            + "and c.validFrom <= :now "
            + "and c.validUntil >= :now "
            + "and c.currentUses < c.maxUses")
    List<CouponJpaEntity> findActiveAt(@Param("now") Instant now);

    /**
     * Atomically validates remaining capacity and increments {@code currentUses}.
     * The predicate {@code current_uses < max_uses} is evaluated by the DB inside
     * the same statement that performs the increment, so two concurrent applies on
     * the last seat cannot both succeed — exactly one update wins, the other
     * returns 0 rows affected.
     *
     * <p>The {@code @Transactional} declaration here keeps the sync point self-
     * contained: the controller stays non-transactional, and any caller — including
     * tests invoking the repository directly — gets a single-statement transaction
     * without having to wrap it themselves.</p>
     */
    @Modifying
    @Transactional
    @Query("update CouponJpaEntity c set c.currentUses = c.currentUses + 1 "
            + "where c.id = :id and c.currentUses < c.maxUses")
    int tryConsumeUsage(@Param("id") Long id);
}
