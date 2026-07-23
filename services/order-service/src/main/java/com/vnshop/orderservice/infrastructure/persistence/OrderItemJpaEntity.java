package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.infrastructure.persistence.BaseJpaEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(schema = "order_svc", name = "order_items")
@Getter
@Setter
public class OrderItemJpaEntity extends BaseJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sub_order_id", nullable = false)
    private SubOrderJpaEntity subOrder;

    @Column(name = "product_id", nullable = false)
    private String productId;

    @Column(name = "variant_sku", nullable = false)
    private String variantSku;

    @Column(name = "seller_id", nullable = false)
    private String sellerId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Embedded
    @AttributeOverrides({
            @AttributeOverride(name = "amount", column = @Column(name = "unit_price_amount", nullable = false, precision = 19, scale = 0)),
            @AttributeOverride(name = "currency", column = @Column(name = "unit_price_currency", nullable = false, length = 8))
    })
    private OrderJpaEntity.MoneyEmbeddable unitPrice;

    @Column(name = "image_url", length = 1024)
    private String imageUrl;

    @Column(name = "tax_rate", precision = 5, scale = 4)
    private BigDecimal taxRate;

    @Column(name = "tax_amount", precision = 19, scale = 0)
    private BigDecimal taxAmount;

    protected OrderItemJpaEntity() {
    }

    static OrderItemJpaEntity fromDomain(OrderItem item, SubOrderJpaEntity subOrder) {
        OrderItemJpaEntity entity = new OrderItemJpaEntity();
        entity.subOrder = subOrder;
        entity.productId = item.productId();
        entity.variantSku = item.variantSku();
        entity.sellerId = item.sellerId();
        entity.name = item.name();
        entity.quantity = item.quantity();
        entity.unitPrice = OrderJpaEntity.MoneyEmbeddable.fromDomain(item.unitPrice());
        entity.imageUrl = item.imageUrl();
        entity.taxRate = item.taxRate();
        entity.taxAmount = item.taxAmount();
        return entity;
    }

    OrderItem toDomain() {
        return new OrderItem(productId, variantSku, sellerId, name, quantity, unitPrice.toDomain(), imageUrl,
                taxRate, taxAmount);
    }
}
