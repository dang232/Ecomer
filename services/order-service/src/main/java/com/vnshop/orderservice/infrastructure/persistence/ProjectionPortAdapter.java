package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.port.out.ProjectionPort;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;

@Component
public class ProjectionPortAdapter implements ProjectionPort {
    @PersistenceContext
    private EntityManager em;

    @Override
    @Transactional
    public void upsertOrderSummary(String orderId, String orderNumber, String status, String buyerId, String sellerId,
                                   BigDecimal totalAmount, int itemCount) {
        OrderSummaryProjectionJpaEntity existing = em.find(OrderSummaryProjectionJpaEntity.class, orderId);
        Instant now = Instant.now();

        if (existing != null) {
            existing.setStatus(status);
            if (orderNumber != null) existing.setOrderNumber(orderNumber);
            existing.setUpdatedAt(now);
            if (buyerId != null) existing.setBuyerId(buyerId);
            if (sellerId != null) existing.setSellerId(sellerId);
            if (totalAmount != null) existing.setTotalAmount(totalAmount);
            if (itemCount > 0) existing.setItemCount(itemCount);
            em.merge(existing);
        } else {
            OrderSummaryProjectionJpaEntity entity = new OrderSummaryProjectionJpaEntity();
            entity.setOrderId(orderId);
            entity.setOrderNumber(orderNumber);
            entity.setStatus(status);
            entity.setBuyerId(buyerId);
            entity.setSellerId(sellerId);
            entity.setTotalAmount(totalAmount != null ? totalAmount : BigDecimal.ZERO);
            entity.setItemCount(itemCount);
            entity.setCreatedAt(now);
            entity.setUpdatedAt(now);
            em.persist(entity);
        }
    }
}
