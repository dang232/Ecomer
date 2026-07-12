package com.vnshop.searchservice.infrastructure.persistence;

import com.vnshop.searchservice.domain.ProductReadModel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(schema = "search_svc", name = "product_read_models")
@Getter @Setter
public class ProductReadModelJpaEntity {
    @Id
    @Column(name = "product_id")
    private String productId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", length = 2000)
    private String description;

    @Column(name = "category_id")
    private String categoryId;

    @Column(name = "brand")
    private String brand;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "min_price")
    private BigDecimal minPrice;

    @Column(name = "max_price")
    private BigDecimal maxPrice;

    @Column(name = "variant_count", nullable = false)
    private int variantCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "same_day_delivery", nullable = false)
    private boolean sameDayDelivery;

    @Column(name = "verified", nullable = false)
    private boolean verified;

    @Column(name = "is_official", nullable = false)
    private boolean isOfficial;

    protected ProductReadModelJpaEntity() {
    }

    public ProductReadModelJpaEntity(String productId, String name, String description, String categoryId, String brand, String status, BigDecimal minPrice, BigDecimal maxPrice, int variantCount, Instant createdAt, boolean sameDayDelivery, boolean verified, boolean isOfficial) {
        this.productId = productId;
        this.name = name;
        this.description = description;
        this.categoryId = categoryId;
        this.brand = brand;
        this.status = status;
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
        this.variantCount = variantCount;
        this.createdAt = createdAt;
        this.sameDayDelivery = sameDayDelivery;
        this.verified = verified;
        this.isOfficial = isOfficial;
    }

    public static ProductReadModelJpaEntity fromDomain(ProductReadModel model) {
        return new ProductReadModelJpaEntity(
                model.productId(),
                model.name(),
                model.description(),
                model.categoryId(),
                model.brand(),
                model.status(),
                model.minPrice(),
                model.maxPrice(),
                model.variantCount(),
                model.createdAt(),
                model.sameDayDelivery(),
                model.verified(),
                model.isOfficial()
        );
    }

    public static ProductReadModelJpaEntity fromEvent(String productId, Map<String, Object> payload) {
        return new ProductReadModelJpaEntity(
                productId,
                stringValue(payload.get("name")),
                stringValue(payload.get("description")),
                stringValue(payload.get("categoryId")),
                stringValue(payload.get("brand")),
                stringValue(payload.getOrDefault("status", "DRAFT")),
                decimalValue(payload.get("minPrice")),
                decimalValue(payload.get("maxPrice")),
                intValue(payload.get("variantCount")),
                Instant.now(),
                booleanValue(payload.get("sameDayDelivery")),
                booleanValue(payload.get("verified")),
                booleanValue(payload.get("isOfficial"))
        );
    }

    public ProductReadModel toDomain() {
        return new ProductReadModel(productId, name, description, categoryId, brand, status, minPrice, maxPrice, variantCount, createdAt, sameDayDelivery, verified, isOfficial);
    }

    private static String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private static BigDecimal decimalValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        return new BigDecimal(value.toString());
    }

    private static int intValue(Object value) {
        if (value == null) {
            return 0;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        return Integer.parseInt(value.toString());
    }

    private static boolean booleanValue(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(value.toString());
    }
}
