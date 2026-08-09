package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.PayoutStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Pageable;

public interface PayoutSpringDataRepository extends JpaRepository<PayoutJpaEntity, UUID> {
    List<PayoutJpaEntity> findByStatus(PayoutStatus status);

    @Query("select p from PayoutJpaEntity p where "
            + "(:status is null or p.status = :status) and "
            + "(:term = '' or lower(p.sellerId) like :likeTerm or lower(str(p.payoutId)) like :likeTerm) and "
            + "(:beforeCreatedAt is null or p.createdAt < :beforeCreatedAt "
            + "or (p.createdAt = :beforeCreatedAt and p.payoutId < :beforePayoutId)) "
            + "order by p.createdAt desc, p.payoutId desc")
    List<PayoutJpaEntity> findAdminCursor(
            @Param("term") String term,
            @Param("likeTerm") String likeTerm,
            @Param("status") PayoutStatus status,
            @Param("beforeCreatedAt") Instant beforeCreatedAt,
            @Param("beforePayoutId") UUID beforePayoutId,
            Pageable pageable);

    java.util.Optional<PayoutJpaEntity> findBySellerIdAndIdempotencyKey(String sellerId, String idempotencyKey);

    @Query("select p from PayoutJpaEntity p where p.status = :status and "
            + "(:term = '' or lower(p.sellerId) like :likeTerm or lower(str(p.payoutId)) like :likeTerm) "
            + "order by p.createdAt desc")
    List<PayoutJpaEntity> findByStatusAndQuery(@Param("status") PayoutStatus status,
            @Param("term") String term, @Param("likeTerm") String likeTerm);

    List<PayoutJpaEntity> findByStatusOrderByCompletedAtDesc(PayoutStatus status);

    @Query("select p from PayoutJpaEntity p where p.status = :status and "
            + "(:term = '' or lower(p.sellerId) like :likeTerm or lower(str(p.payoutId)) like :likeTerm) "
            + "order by p.completedAt desc")
    List<PayoutJpaEntity> findCompletedAndQuery(@Param("status") PayoutStatus status,
            @Param("term") String term, @Param("likeTerm") String likeTerm);

    List<PayoutJpaEntity> findBySellerId(String sellerId);
}
