package com.vnshop.searchservice.infrastructure.persistence;

import com.vnshop.searchservice.domain.ProductReadModel;
import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.Collection;
import java.util.List;

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

    @Column(name = "average_rating")
    private Float averageRating;

    @Column(name = "review_count")
    private Integer reviewCount;

    @Column(name = "variant_count", nullable = false)
    private int variantCount;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "stock", nullable = false)
    private int stock;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "same_day_delivery", nullable = false)
    private boolean sameDayDelivery;

    @Column(name = "verified", nullable = false)
    private boolean verified;

    @Column(name = "is_official", nullable = false)
    private boolean isOfficial;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(schema = "search_svc", name = "product_read_model_tags", joinColumns = @JoinColumn(name = "product_id"))
    @Column(name = "tag_key", nullable = false)
    private List<String> tags = List.of();

    protected ProductReadModelJpaEntity() {
    }

    public ProductReadModelJpaEntity(String productId, String name, String description, String categoryId, String brand, String status,
            BigDecimal minPrice, BigDecimal maxPrice, int variantCount, String imageUrl, int stock, Instant createdAt,
            boolean sameDayDelivery, boolean verified, boolean isOfficial) {
        this(productId, name, description, categoryId, brand, status, minPrice, maxPrice, null, null,
                variantCount, imageUrl, stock, createdAt, sameDayDelivery, verified, isOfficial, List.of());
    }

    public ProductReadModelJpaEntity(String productId, String name, String description, String categoryId, String brand, String status,
            BigDecimal minPrice, BigDecimal maxPrice, Float averageRating, Integer reviewCount,
            int variantCount, String imageUrl, int stock, Instant createdAt, boolean sameDayDelivery,
            boolean verified, boolean isOfficial, List<String> tags) {
        this.productId = productId;
        this.name = name;
        this.description = description;
        this.categoryId = categoryId;
        this.brand = brand;
        this.status = status;
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
        this.averageRating = averageRating;
        this.reviewCount = reviewCount;
        this.variantCount = variantCount;
        this.imageUrl = imageUrl;
        this.stock = stock;
        this.createdAt = createdAt;
        this.sameDayDelivery = sameDayDelivery;
        this.verified = verified;
        this.isOfficial = isOfficial;
        this.tags = tags == null ? List.of() : List.copyOf(tags);
    }

    public ProductReadModelJpaEntity(String productId, String name, String description, String categoryId, String brand, String status,
            BigDecimal minPrice, BigDecimal maxPrice, Float averageRating, Integer reviewCount,
            int variantCount, String imageUrl, int stock, Instant createdAt, boolean sameDayDelivery,
            boolean verified, boolean isOfficial) {
        this(productId, name, description, categoryId, brand, status, minPrice, maxPrice, averageRating, reviewCount,
                variantCount, imageUrl, stock, createdAt, sameDayDelivery, verified, isOfficial, List.of());
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
                model.averageRating(),
                model.reviewCount(),
                model.variantCount(),
                model.imageUrl(),
                model.stock(),
                model.createdAt(),
                model.sameDayDelivery(),
                model.verified(),
                model.isOfficial(),
                model.tags()
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
                floatValue(payload.get("averageRating")),
                intObjectValue(payload.get("reviewCount")),
                intValue(payload.get("variantCount")),
                stringValue(payload.get("imageUrl")),
                intValue(payload.get("stock")),
                Instant.now(),
                booleanValue(payload.get("sameDayDelivery")),
                booleanValue(payload.get("verified")),
                booleanValue(payload.get("isOfficial")),
                tagKeys(payload.get("tags"))
        );
    }

    public ProductReadModel toDomain() {
        return new ProductReadModel(productId, name, description, categoryId, brand, status, minPrice, maxPrice,
                averageRating, reviewCount, variantCount, imageUrl, stock, createdAt, sameDayDelivery, verified, isOfficial, tags);
    }

    public Float getAverageRating() {
        return averageRating;
    }

    public void setAverageRating(Float averageRating) {
        this.averageRating = averageRating;
    }

    public Integer getReviewCount() {
        return reviewCount;
    }

    public void setReviewCount(Integer reviewCount) {
        this.reviewCount = reviewCount;
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

    private static Integer intObjectValue(Object value) {
        return value == null ? null : intValue(value);
    }

    private static Float floatValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.floatValue();
        }
        return Float.parseFloat(value.toString());
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

    private static List<String> tagKeys(Object value) {
        if (!(value instanceof Collection<?> values)) {
            return List.of();
        }
        return values.stream()
                .map(item -> item instanceof Map<?, ?> map ? map.get("key") : item)
                .filter(item -> item != null && !item.toString().isBlank())
                .map(Object::toString)
                .distinct()
                .sorted()
                .toList();
    }
}
