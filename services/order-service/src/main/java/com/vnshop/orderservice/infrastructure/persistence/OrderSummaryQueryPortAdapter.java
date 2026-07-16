package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.port.out.OrderSummaryQueryPort;
import com.vnshop.orderservice.domain.projection.OrderSummaryProjection;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;

@Component
public class OrderSummaryQueryPortAdapter implements OrderSummaryQueryPort {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public List<OrderSummaryProjection> findByBuyerId(String buyerId) {
        return entityManager
            .createQuery("SELECT o FROM OrderSummaryProjectionJpaEntity o WHERE o.buyerId = :buyerId ORDER BY o.createdAt DESC", OrderSummaryProjectionJpaEntity.class)
            .setParameter("buyerId", buyerId)
            .getResultStream()
            .map(OrderSummaryProjectionJpaEntity::toDomain)
            .toList();
    }

    @Override
    public Page<OrderSummaryProjection> findByBuyerId(String buyerId, String status, Pageable pageable) {
        boolean hasStatus = status != null && !status.isBlank();
        String where = "WHERE o.buyerId = :buyerId" + (hasStatus ? " AND o.status = :status" : "");

        TypedQuery<Long> countQuery = entityManager.createQuery(
            "SELECT COUNT(o) FROM OrderSummaryProjectionJpaEntity o " + where, Long.class)
            .setParameter("buyerId", buyerId);
        if (hasStatus) countQuery.setParameter("status", status);
        long total = countQuery.getSingleResult();

        TypedQuery<OrderSummaryProjectionJpaEntity> dataQuery = entityManager.createQuery(
            "SELECT o FROM OrderSummaryProjectionJpaEntity o " + where + " ORDER BY o.createdAt DESC",
            OrderSummaryProjectionJpaEntity.class)
            .setParameter("buyerId", buyerId);
        if (hasStatus) dataQuery.setParameter("status", status);
        dataQuery.setFirstResult((int) pageable.getOffset());
        dataQuery.setMaxResults(pageable.getPageSize());

        List<OrderSummaryProjection> content = dataQuery.getResultStream()
            .map(OrderSummaryProjectionJpaEntity::toDomain)
            .toList();

        return new PageImpl<>(content, pageable, total);
    }

    @Override
    public Optional<OrderSummaryProjection> findByOrderId(String orderId) {
        OrderSummaryProjectionJpaEntity entity = entityManager.find(OrderSummaryProjectionJpaEntity.class, orderId);
        return Optional.ofNullable(entity).map(OrderSummaryProjectionJpaEntity::toDomain);
    }

    @Override
    public List<OrderSummaryProjection> findAll(String status) {
        boolean hasStatus = status != null && !status.isBlank();
        String filter = hasStatus
                ? "WHERE EXISTS (SELECT 1 FROM order_svc.sub_orders filter_so "
                    + "WHERE filter_so.order_id = o.id AND filter_so.fulfillment_status = :status)"
                : "";
        String sql = """
                SELECT o.id::text,
                       o.buyer_id,
                       MIN(so.seller_id),
                       CASE
                           WHEN MAX(CASE WHEN so.fulfillment_status = 'PENDING_ACCEPTANCE' THEN 1 ELSE 0 END) = 1
                               THEN 'PENDING_ACCEPTANCE'
                           WHEN MAX(CASE WHEN so.fulfillment_status = 'ACCEPTED' THEN 1 ELSE 0 END) = 1
                               THEN 'ACCEPTED'
                           WHEN MAX(CASE WHEN so.fulfillment_status = 'PACKED' THEN 1 ELSE 0 END) = 1
                               THEN 'PACKED'
                           WHEN MAX(CASE WHEN so.fulfillment_status = 'SHIPPED' THEN 1 ELSE 0 END) = 1
                               THEN 'SHIPPED'
                           WHEN MAX(CASE WHEN so.fulfillment_status = 'DELIVERED' THEN 1 ELSE 0 END) = 1
                               THEN 'DELIVERED'
                           WHEN MAX(CASE WHEN so.fulfillment_status = 'REJECTED' THEN 1 ELSE 0 END) = 1
                               THEN 'REJECTED'
                           WHEN MAX(CASE WHEN so.fulfillment_status = 'CANCELLED' THEN 1 ELSE 0 END) = 1
                               THEN 'CANCELLED'
                           ELSE 'UNKNOWN'
                       END,
                       o.final_amount,
                       COALESCE(SUM(oi.quantity), 0),
                       o.created_at,
                       o.updated_at
                FROM order_svc.orders o
                LEFT JOIN order_svc.sub_orders so ON so.order_id = o.id
                LEFT JOIN order_svc.order_items oi ON oi.sub_order_id = so.id
                %s
                GROUP BY o.id, o.buyer_id, o.final_amount, o.created_at, o.updated_at
                ORDER BY o.created_at DESC
                LIMIT 200
                """.formatted(filter);

        var query = entityManager.createNativeQuery(sql);
        if (hasStatus) query.setParameter("status", status);
        return ((List<?>) query.getResultList()).stream()
                .map(OrderSummaryQueryPortAdapter::toAdminProjection)
                .toList();
    }

    private static OrderSummaryProjection toAdminProjection(Object row) {
        Object[] values = (Object[]) row;
        return new OrderSummaryProjection(
                (String) values[0],
                (String) values[1],
                (String) values[2],
                (String) values[3],
                (java.math.BigDecimal) values[4],
                ((Number) values[5]).intValue(),
                toInstant(values[6]),
                toInstant(values[7]));
    }

    private static Instant toInstant(Object value) {
        if (value instanceof Instant instant) return instant;
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value == null) return null;

        String text = value.toString();
        try {
            return Instant.parse(text);
        } catch (DateTimeParseException ignored) {
            return LocalDateTime.parse(text).toInstant(ZoneOffset.UTC);
        }
    }
}
