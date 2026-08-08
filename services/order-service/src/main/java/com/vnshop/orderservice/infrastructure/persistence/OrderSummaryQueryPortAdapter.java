package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.port.out.OrderSummaryQueryPort;
import com.vnshop.orderservice.domain.projection.OrderSummaryProjection;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
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
    public Page<OrderSummaryProjection> findAll(String query, String status, Pageable pageable) {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase();
        boolean hasStatus = status != null && !status.isBlank();
        String where = "WHERE (:term = '' OR lower(coalesce(o.orderId, '')) LIKE :likeTerm "
                + "OR lower(coalesce(o.orderNumber, '')) LIKE :likeTerm "
                + "OR lower(coalesce(o.buyerId, '')) LIKE :likeTerm "
                + "OR lower(coalesce(o.sellerId, '')) LIKE :likeTerm)"
                + (hasStatus ? " AND o.status = :status" : "");

        TypedQuery<Long> countQuery = entityManager.createQuery(
                "SELECT COUNT(o) FROM OrderSummaryProjectionJpaEntity o " + where, Long.class)
                .setParameter("term", normalizedQuery)
                .setParameter("likeTerm", "%" + normalizedQuery + "%");
        if (hasStatus) countQuery.setParameter("status", status);
        long total = countQuery.getSingleResult();

        int pageSize = Math.min(Math.max(pageable.getPageSize(), 1), 200);
        Pageable bounded = PageRequest.of(pageable.getPageNumber(), pageSize);
        TypedQuery<OrderSummaryProjectionJpaEntity> dataQuery = entityManager.createQuery(
                "SELECT o FROM OrderSummaryProjectionJpaEntity o " + where + " ORDER BY o.createdAt DESC",
                OrderSummaryProjectionJpaEntity.class)
                .setParameter("term", normalizedQuery)
                .setParameter("likeTerm", "%" + normalizedQuery + "%")
                .setFirstResult((int) bounded.getOffset())
                .setMaxResults(bounded.getPageSize());
        if (hasStatus) dataQuery.setParameter("status", status);

        List<OrderSummaryProjection> content = dataQuery.getResultStream()
                .map(OrderSummaryProjectionJpaEntity::toDomain)
                .toList();
        return new PageImpl<>(content, bounded, total);
    }

    @Override
    public List<OrderSummaryProjection> findAllCursor(String query, String status, Instant createdAtBefore,
            String orderIdBefore, int limitPlusOne) {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase();
        boolean hasStatus = status != null && !status.isBlank();
        boolean hasCursor = createdAtBefore != null && orderIdBefore != null;
        String where = "WHERE (:term = '' OR lower(coalesce(o.orderId, '')) LIKE :likeTerm "
                + "OR lower(coalesce(o.orderNumber, '')) LIKE :likeTerm "
                + "OR lower(coalesce(o.buyerId, '')) LIKE :likeTerm "
                + "OR lower(coalesce(o.sellerId, '')) LIKE :likeTerm)"
                + (hasStatus ? " AND o.status = :status" : "")
                + (hasCursor ? " AND (o.createdAt < :createdAtBefore OR (o.createdAt = :createdAtBefore AND o.orderId < :orderIdBefore))" : "");
        TypedQuery<OrderSummaryProjectionJpaEntity> dataQuery = entityManager.createQuery(
                "SELECT o FROM OrderSummaryProjectionJpaEntity o " + where
                        + " ORDER BY o.createdAt DESC, o.orderId DESC", OrderSummaryProjectionJpaEntity.class)
                .setParameter("term", normalizedQuery)
                .setParameter("likeTerm", "%" + normalizedQuery + "%")
                .setMaxResults(limitPlusOne);
        if (hasStatus) dataQuery.setParameter("status", status);
        if (hasCursor) {
            dataQuery.setParameter("createdAtBefore", createdAtBefore);
            dataQuery.setParameter("orderIdBefore", orderIdBefore);
        }
        return dataQuery.getResultStream().map(OrderSummaryProjectionJpaEntity::toDomain).toList();
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
