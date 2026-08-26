package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.ParcelDimensions;
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

    @Column(name = "parcel_weight_grams")
    private Integer parcelWeightGrams;

    @Column(name = "parcel_length_cm")
    private Integer parcelLengthCm;

    @Column(name = "parcel_width_cm")
    private Integer parcelWidthCm;

    @Column(name = "parcel_height_cm")
    private Integer parcelHeightCm;

    @Column(name = "parcel_declared_value_minor")
    private Long parcelDeclaredValueMinor;

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
        if (item.parcel() != null) {
            entity.parcelWeightGrams = item.parcel().weightGrams();
            entity.parcelLengthCm = item.parcel().lengthCm();
            entity.parcelWidthCm = item.parcel().widthCm();
            entity.parcelHeightCm = item.parcel().heightCm();
            entity.parcelDeclaredValueMinor = item.parcel().declaredValueMinor();
        }
        entity.taxRate = item.taxRate();
        entity.taxAmount = item.taxAmount();
        return entity;
    }

    OrderItem toDomain() {
        ParcelDimensions parcel = parcelDimensions();
        return new OrderItem(productId, variantSku, sellerId, name, quantity, unitPrice.toDomain(), imageUrl,
                parcel, taxRate, taxAmount);
    }

    private ParcelDimensions parcelDimensions() {
        boolean anyParcelValue = parcelWeightGrams != null || parcelLengthCm != null
                || parcelWidthCm != null || parcelHeightCm != null;
        if (!anyParcelValue) {
            return null;
        }
        if (parcelWeightGrams == null || parcelLengthCm == null
                || parcelWidthCm == null || parcelHeightCm == null) {
            throw new IllegalStateException("stored parcel metadata must be complete");
        }
        return new ParcelDimensions(parcelWeightGrams, parcelLengthCm, parcelWidthCm, parcelHeightCm,
                parcelDeclaredValueMinor == null ? 0L : parcelDeclaredValueMinor);
    }
}
