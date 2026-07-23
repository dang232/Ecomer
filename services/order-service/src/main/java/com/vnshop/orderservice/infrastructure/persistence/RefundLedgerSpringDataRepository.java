package com.vnshop.orderservice.infrastructure.persistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import com.vnshop.orderservice.domain.RefundByDate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface RefundLedgerSpringDataRepository extends JpaRepository<RefundLedgerJpaEntity, String> {
    @Query("select coalesce(sum(refund.amount), 0) from RefundLedgerJpaEntity refund "
            + "join refund.order order "
            + "where order.createdAt between :startInclusive and :endInclusive "
            + "and order.createdAt <= :asOf "
            + "and refund.refundedAt <= :asOf "
            + "and refund.status = 'COMPLETED'")
    BigDecimal sumByOrderCreatedAtBetweenAndRefundedAtAtMost(
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive,
            @Param("asOf") Instant asOf);

    @Query("select new com.vnshop.orderservice.domain.RefundByDate(cast(order.createdAt as LocalDate), "
            + "coalesce(sum(refund.amount), 0)) "
            + "from RefundLedgerJpaEntity refund join refund.order order "
            + "where order.createdAt between :startInclusive and :endInclusive "
            + "and order.createdAt <= :asOf "
            + "and refund.refundedAt <= :asOf "
            + "and refund.status = 'COMPLETED' "
            + "group by cast(order.createdAt as LocalDate) "
            + "order by cast(order.createdAt as LocalDate)")
    List<RefundByDate> sumByOrderCreatedDateBetweenAndRefundedAtAtMost(
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive,
            @Param("asOf") Instant asOf);
}
