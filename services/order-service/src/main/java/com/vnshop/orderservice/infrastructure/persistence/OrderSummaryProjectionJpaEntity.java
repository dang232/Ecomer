package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.projection.OrderSummaryProjection;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(schema = "order_svc", name = "order_summary")
@Getter @Setter
public class OrderSummaryProjectionJpaEntity {
    @Id
    @Column(name = "order_id", length = 36, nullable = false)
    private String orderId;

    @Column(name = "order_number", length = 255)
    private String orderNumber;

    @Column(name = "buyer_id", length = 36)
    private String buyerId;

    @Column(name = "seller_id", length = 36)
    private String sellerId;

    @Column(name = "status", length = 30, nullable = false)
    private String status;

    @Column(name = "total_amount", precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "item_count", nullable = false)
    private int itemCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public OrderSummaryProjectionJpaEntity() {}

    public OrderSummaryProjection toDomain() {
        return new OrderSummaryProjection(orderId, orderNumber, buyerId, sellerId, status, totalAmount, itemCount, createdAt, updatedAt);
    }

    public static OrderSummaryProjectionJpaEntity fromDomain(OrderSummaryProjection p) {
        var entity = new OrderSummaryProjectionJpaEntity();
        entity.setOrderId(p.orderId());
        entity.setOrderNumber(p.orderNumber());
        entity.setBuyerId(p.buyerId());
        entity.setSellerId(p.sellerId());
        entity.setStatus(p.status());
        entity.setTotalAmount(p.totalAmount());
        entity.setItemCount(p.itemCount());
        entity.setCreatedAt(p.createdAt());
        entity.setUpdatedAt(p.updatedAt());
        return entity;
    }
}
