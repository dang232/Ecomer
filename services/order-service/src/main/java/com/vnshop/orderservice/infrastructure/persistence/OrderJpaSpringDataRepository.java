package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.PaymentStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderJpaSpringDataRepository extends JpaRepository<OrderJpaEntity, UUID> {
    Optional<OrderJpaEntity> findByOrderNumber(String orderNumber);

    Optional<OrderJpaEntity> findByIdempotencyKey(String idempotencyKey);

    @Query("""
        SELECT DISTINCT o FROM OrderJpaEntity o
        LEFT JOIN FETCH o.subOrders
        WHERE o.buyerId = :buyerId
        """)
    List<OrderJpaEntity> findByBuyerId(@Param("buyerId") String buyerId);

    @Query("""
        SELECT DISTINCT o FROM OrderJpaEntity o
        LEFT JOIN FETCH o.subOrders
        WHERE o.id = :orderId
        """)
    Optional<OrderJpaEntity> findByIdWithGraph(@Param("orderId") UUID orderId);

    @Query("""
        SELECT DISTINCT o FROM OrderJpaEntity o
        LEFT JOIN FETCH o.subOrders
        WHERE o.id = :orderId
        """)
    Optional<OrderJpaEntity> findByIdWithSubOrders(@Param("orderId") UUID orderId);

    @Query("""
        SELECT DISTINCT o FROM OrderJpaEntity o
        LEFT JOIN FETCH o.subOrders
        WHERE o.idempotencyKey = :key
        """)
    Optional<OrderJpaEntity> findByIdempotencyKeyWithGraph(@Param("key") String key);

    @Query("select subOrder.order.id from SubOrderJpaEntity subOrder where subOrder.id = :subOrderId")
    Optional<UUID> findOrderIdBySubOrderId(@Param("subOrderId") Long subOrderId);

    @Query("""
        SELECT DISTINCT o FROM OrderJpaEntity o
        LEFT JOIN FETCH o.subOrders sub
        WHERE o.id = (SELECT subOrder.order.id FROM SubOrderJpaEntity subOrder WHERE subOrder.id = :subOrderId)
        """)
    Optional<OrderJpaEntity> findBySubOrderId(@Param("subOrderId") Long subOrderId);

    @Query("""
        SELECT DISTINCT o FROM OrderJpaEntity o
        LEFT JOIN FETCH o.subOrders sub
        WHERE sub.sellerId = :sellerId AND sub.fulfillmentStatus = :status
        """)
    List<OrderJpaEntity> findBySellerIdAndFulfillmentStatus(
            @Param("sellerId") String sellerId,
            @Param("status") FulfillmentStatus status
    );

    @Query("""
        SELECT DISTINCT o FROM OrderJpaEntity o
        LEFT JOIN FETCH o.subOrders sub
        WHERE sub.sellerId = :sellerId AND sub.fulfillmentStatus IN :statuses
        """)
    List<OrderJpaEntity> findBySellerIdAndFulfillmentStatusIn(
            @Param("sellerId") String sellerId,
            @Param("statuses") List<FulfillmentStatus> statuses
    );

    @Query("""
        SELECT DISTINCT o FROM OrderJpaEntity o
        LEFT JOIN FETCH o.subOrders sub
        WHERE sub.sellerId = :sellerId
          AND sub.fulfillmentStatus IN :statuses
          AND (
      :term = ''
      OR lower(str(sub.id)) LIKE :likeTerm
      OR lower(str(o.id)) LIKE :likeTerm
              OR lower(o.orderNumber) LIKE :likeTerm
              OR EXISTS (
                  SELECT item.id FROM OrderItemJpaEntity item
                  WHERE item.subOrder = sub
                    AND lower(item.name) LIKE :likeTerm
              )
          )
        """)
    List<OrderJpaEntity> findBySellerIdAndFulfillmentStatusInAndQuery(
            @Param("sellerId") String sellerId,
            @Param("statuses") List<FulfillmentStatus> statuses,
            @Param("term") String term,
            @Param("likeTerm") String likeTerm
    );

    long countByBuyerIdAndCreatedAtAfterAndPaymentStatusNot(
            String buyerId, Instant since, com.vnshop.orderservice.domain.PaymentStatus excludedStatus);

    long countByCreatedAtBetween(Instant startInclusive, Instant endInclusive);

    @Query("select coalesce(sum(order.finalAmount.amount), 0) from OrderJpaEntity order where order.createdAt between :startInclusive and :endInclusive")
    BigDecimal sumRevenueByCreatedAtBetween(
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive
    );

    @Query("select count(distinct order.buyerId) from OrderJpaEntity order where order.createdAt between :startInclusive and :endInclusive")
    long countDistinctBuyerIdByCreatedAtBetween(
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive
    );

    @Query("select count(distinct subOrder.sellerId) from SubOrderJpaEntity subOrder where subOrder.order.createdAt between :startInclusive and :endInclusive")
    long countDistinctSellerIdByCreatedAtBetween(
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive
    );

    @Query("select new com.vnshop.orderservice.infrastructure.persistence.OrderJpaRepository$RevenueByDate(cast(order.createdAt as LocalDate), coalesce(sum(order.finalAmount.amount), 0)) from OrderJpaEntity order where order.createdAt between :startInclusive and :endInclusive group by cast(order.createdAt as LocalDate) order by cast(order.createdAt as LocalDate)")
    List<OrderJpaRepository.RevenueByDate> revenueByDateBetween(
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive
    );

    @Query("select new com.vnshop.orderservice.infrastructure.persistence.OrderJpaRepository$TopMetric(item.productId, min(item.name), sum(item.quantity)) from OrderItemJpaEntity item group by item.productId order by sum(item.quantity) desc")
    List<OrderJpaRepository.TopMetric> topProducts(Pageable pageable);

    @Query("select new com.vnshop.orderservice.infrastructure.persistence.OrderJpaRepository$TopMetric(subOrder.sellerId, subOrder.sellerId, coalesce(sum(subOrder.order.finalAmount.amount), 0)) from SubOrderJpaEntity subOrder group by subOrder.sellerId order by coalesce(sum(subOrder.order.finalAmount.amount), 0) desc")
    List<OrderJpaRepository.TopMetric> topSellers(Pageable pageable);

    @Query("select new com.vnshop.orderservice.infrastructure.persistence.OrderJpaRepository$SellerRevenueByDate("
            + "cast(item.subOrder.order.createdAt as LocalDate), "
            + "coalesce(sum(item.unitPrice.amount * item.quantity), 0), "
            + "count(distinct item.subOrder.id)) "
            + "from OrderItemJpaEntity item "
            + "where item.sellerId = :sellerId "
            + "and item.subOrder.order.createdAt between :startInclusive and :endInclusive "
            + "group by cast(item.subOrder.order.createdAt as LocalDate) "
            + "order by cast(item.subOrder.order.createdAt as LocalDate)")
    List<OrderJpaRepository.SellerRevenueByDate> sellerRevenueByDateBetween(
            @Param("sellerId") String sellerId,
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive
    );

    long countByCreatedAtBetweenAndPaymentStatus(
            Instant startInclusive, Instant endInclusive, PaymentStatus paymentStatus);

    @Query("select coalesce(sum(order.finalAmount.amount), 0) from OrderJpaEntity order "
            + "where order.createdAt between :startInclusive and :endInclusive "
            + "and order.paymentStatus = :paymentStatus")
    BigDecimal sumPaidGmvByCreatedAtBetween(
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive,
            @Param("paymentStatus") PaymentStatus paymentStatus
    );

    @Query("select count(distinct order.buyerId) from OrderJpaEntity order "
            + "where order.createdAt between :startInclusive and :endInclusive "
            + "and order.paymentStatus = :paymentStatus")
    long countDistinctPaidBuyerIdByCreatedAtBetween(
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive,
            @Param("paymentStatus") PaymentStatus paymentStatus
    );

    @Query("select count(distinct subOrder.sellerId) from SubOrderJpaEntity subOrder "
            + "where subOrder.order.createdAt between :startInclusive and :endInclusive "
            + "and subOrder.order.paymentStatus = :paymentStatus")
    long countDistinctPaidSellerIdByCreatedAtBetween(
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive,
            @Param("paymentStatus") PaymentStatus paymentStatus
    );

    @Query("select new com.vnshop.orderservice.infrastructure.persistence.OrderJpaRepository$RevenueByDate("
            + "cast(order.createdAt as LocalDate), coalesce(sum(order.finalAmount.amount), 0)) "
            + "from OrderJpaEntity order where order.createdAt between :startInclusive and :endInclusive "
            + "and order.paymentStatus = :paymentStatus "
            + "group by cast(order.createdAt as LocalDate) order by cast(order.createdAt as LocalDate)")
    List<OrderJpaRepository.RevenueByDate> paidGmvByDateBetween(
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive,
            @Param("paymentStatus") PaymentStatus paymentStatus
    );

    @Query("select new com.vnshop.orderservice.infrastructure.persistence.OrderJpaRepository$TopMetric("
            + "item.productId, min(item.name), sum(item.quantity)) "
            + "from OrderItemJpaEntity item "
            + "where item.subOrder.order.createdAt between :startInclusive and :endInclusive "
            + "and item.subOrder.order.paymentStatus = :paymentStatus "
            + "group by item.productId order by sum(item.quantity) desc")
    List<OrderJpaRepository.TopMetric> topProductsByUnitsSold(
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive,
            @Param("paymentStatus") PaymentStatus paymentStatus,
            Pageable pageable
    );

    @Query("select new com.vnshop.orderservice.infrastructure.persistence.OrderJpaRepository$TopMetric("
            + "subOrder.sellerId, subOrder.sellerId, "
            + "coalesce(sum(item.unitPrice.amount * item.quantity), 0)) "
            + "from SubOrderJpaEntity subOrder join subOrder.items item "
            + "where subOrder.order.createdAt between :startInclusive and :endInclusive "
            + "and subOrder.order.paymentStatus = :paymentStatus "
            + "group by subOrder.sellerId "
            + "order by coalesce(sum(item.unitPrice.amount * item.quantity), 0) desc")
    List<OrderJpaRepository.TopMetric> topSellersByPaidGmv(
            @Param("startInclusive") Instant startInclusive,
            @Param("endInclusive") Instant endInclusive,
            @Param("paymentStatus") PaymentStatus paymentStatus,
            Pageable pageable
    );
}
