package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.CommissionTier;
import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.ShippingInfo;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.infrastructure.persistence.BaseJpaEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(schema = "order_svc", name = "sub_orders")
@Getter
@Setter
public class SubOrderJpaEntity extends BaseJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private OrderJpaEntity order;

    @Column(name = "seller_id", nullable = false)
    private String sellerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "fulfillment_status", nullable = false)
    private FulfillmentStatus fulfillmentStatus;

    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "amount", column = @Column(name = "shipping_cost_amount", nullable = false, precision = 19, scale = 0)),
            @AttributeOverride(name = "currency", column = @Column(name = "shipping_cost_currency", nullable = false, length = 8))
    })
    private OrderJpaEntity.MoneyEmbeddable shippingCost;

    @Column(name = "shipping_method", nullable = false)
    private String shippingMethod;

    @Column(name = "carrier")
    private String carrier;

    @Column(name = "tracking_number")
    private String trackingNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "commission_tier", nullable = false)
    private CommissionTier commissionTier = CommissionTier.STANDARD;

    @OneToMany(mappedBy = "subOrder", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Fetch(FetchMode.SUBSELECT)
    private List<OrderItemJpaEntity> items = new ArrayList<>();

    protected SubOrderJpaEntity() {
    }

    static SubOrderJpaEntity fromDomain(SubOrder subOrder, OrderJpaEntity order) {
        SubOrderJpaEntity entity = new SubOrderJpaEntity();
        // Preserve the existing id on update. Without this every save(order) on
        // the parent runs the @OneToMany orphanRemoval path: the old child rows
        // are deleted and re-inserted with new BIGSERIAL ids. That breaks any
        // follow-up call (e.g. /seller/orders/{subOrderId}/ship) that quoted
        // the original id from the accept response.
        entity.id = subOrder.id();
        entity.order = order;
        entity.sellerId = subOrder.sellerId();
        entity.fulfillmentStatus = subOrder.fulfillmentStatus();
        entity.shippingCost = OrderJpaEntity.MoneyEmbeddable.fromDomain(subOrder.shippingCost());
        entity.shippingMethod = subOrder.shippingMethod();
        entity.carrier = subOrder.carrier();
        entity.trackingNumber = subOrder.trackingNumber();
        entity.commissionTier = subOrder.commissionTier();
        entity.items = subOrder.items().stream()
                .map(item -> OrderItemJpaEntity.fromDomain(item, entity))
                .toList();
        return entity;
    }


    SubOrder toDomain() {
        ShippingInfo shipping = new ShippingInfo(
                shippingCost.toDomain(),
                shippingMethod,
                carrier,
                trackingNumber
        );
        return new SubOrder(
                id,
                sellerId,
                items.stream().map(OrderItemJpaEntity::toDomain).toList(),
                fulfillmentStatus,
                shipping,
                commissionTier
        );
    }
}
