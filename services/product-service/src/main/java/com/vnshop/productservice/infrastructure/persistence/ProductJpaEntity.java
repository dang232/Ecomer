package com.vnshop.productservice.infrastructure.persistence;

import com.vnshop.productservice.infrastructure.persistence.BaseJpaEntity;
import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductImage;
import com.vnshop.productservice.domain.ProductStatus;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.ProductTag;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(schema = "product_svc", name = "products")
@Getter
@Setter
public class ProductJpaEntity extends BaseJpaEntity {
    @Id
    @Column(name = "id", columnDefinition = "uuid")
    private UUID id;

    @Column(name = "seller_id", nullable = false)
    private String sellerId;

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

    @Column(name = "same_day_delivery", nullable = false)
    private boolean sameDayDelivery;

    @Column(name = "verified", nullable = false)
    private boolean verified;

    @Column(name = "is_official", nullable = false)
    private boolean isOfficial;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(schema = "product_svc", name = "product_variants", joinColumns = @JoinColumn(name = "product_id"))
    private List<ProductVariantEmbeddable> variants = new ArrayList<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(schema = "product_svc", name = "product_images", joinColumns = @JoinColumn(name = "product_id"))
    private List<ProductImageEmbeddable> images = new ArrayList<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(schema = "product_svc", name = "product_tags", joinColumns = @JoinColumn(name = "product_id"))
    private List<ProductTagEmbeddable> tags = new ArrayList<>();

    protected ProductJpaEntity() {
    }

    static ProductJpaEntity fromDomain(Product product) {
        ProductJpaEntity entity = new ProductJpaEntity();
        entity.id = product.productId();
        entity.sellerId = product.sellerId();
        entity.name = product.name();
        entity.description = product.description();
        entity.categoryId = product.categoryId();
        entity.brand = product.brand();
        entity.status = product.status().name();
        entity.sameDayDelivery = product.sameDayDelivery();
        entity.verified = product.verified();
        entity.isOfficial = product.isOfficial();
        entity.variants = product.variants().stream().map(ProductVariantEmbeddable::fromDomain).toList();
        entity.images = product.images().stream().map(ProductImageEmbeddable::fromDomain).toList();
        entity.tags = product.tags().stream().map(ProductTagEmbeddable::fromDomain).toList();
        return entity;
    }

    Product toDomain() {
        Product product = new Product(
                id,
                sellerId,
                name,
                description,
                categoryId,
                brand,
                variants.stream().map(ProductVariantEmbeddable::toDomain).toList(),
                images.stream().map(ProductImageEmbeddable::toDomain).toList(),
                tags.stream().map(ProductTagEmbeddable::toDomain).toList(),
                sameDayDelivery,
                verified,
                isOfficial
        );
        ProductStatus mappedStatus = ProductStatus.valueOf(status);
        if (mappedStatus == ProductStatus.ACTIVE) {
            product.publish();
        } else if (mappedStatus == ProductStatus.INACTIVE) {
            product.publish();
            product.deactivate();
        } else if (mappedStatus == ProductStatus.OUT_OF_STOCK) {
            product.setOutOfStock();
        }
        return product;
    }

    @Embeddable
    public static class ProductTagEmbeddable {
        @Column(name = "canonical_key", nullable = false)
        private String canonicalKey;

        @Column(name = "display_label", nullable = false)
        private String displayLabel;

        protected ProductTagEmbeddable() {
        }

        static ProductTagEmbeddable fromDomain(ProductTag tag) {
            ProductTagEmbeddable embeddable = new ProductTagEmbeddable();
            embeddable.canonicalKey = tag.canonicalKey();
            embeddable.displayLabel = tag.displayLabel();
            return embeddable;
        }

        ProductTag toDomain() {
            return new ProductTag(canonicalKey, displayLabel);
        }
    }

    @Embeddable
    public static class ProductVariantEmbeddable {
        @Column(name = "sku", nullable = false)
        private String sku;

        @Column(name = "name")
        private String name;

        @Embedded
        private MoneyEmbeddable price;

        @Column(name = "image_url")
        private String imageUrl;

        @Column(name = "stock_quantity", nullable = false)
        private int stockQuantity;

        protected ProductVariantEmbeddable() {
        }

        static ProductVariantEmbeddable fromDomain(ProductVariant variant) {
            ProductVariantEmbeddable embeddable = new ProductVariantEmbeddable();
            embeddable.sku = variant.sku();
            embeddable.name = variant.name();
            embeddable.price = MoneyEmbeddable.fromDomain(variant.price());
            embeddable.imageUrl = variant.imageUrl();
            embeddable.stockQuantity = variant.stockQuantity();
            return embeddable;
        }

        ProductVariant toDomain() {
            return new ProductVariant(sku, name, price.toDomain(), imageUrl, stockQuantity);
        }
    }

    @Embeddable
    public static class MoneyEmbeddable {
        @Column(name = "price_amount", nullable = false)
        private BigDecimal amount;

        @Column(name = "price_currency", nullable = false)
        private String currency;

        protected MoneyEmbeddable() {
        }

        static MoneyEmbeddable fromDomain(Money money) {
            MoneyEmbeddable embeddable = new MoneyEmbeddable();
            embeddable.amount = money.amount();
            embeddable.currency = money.currency();
            return embeddable;
        }

        Money toDomain() {
            return new Money(amount, currency);
        }
    }

    @Embeddable
    public static class ProductImageEmbeddable {
        @Column(name = "url", nullable = false)
        private String url;

        @Column(name = "alt")
        private String alt;

        @Column(name = "sort_order")
        private int sortOrder;

        protected ProductImageEmbeddable() {
        }

        static ProductImageEmbeddable fromDomain(ProductImage image) {
            ProductImageEmbeddable embeddable = new ProductImageEmbeddable();
            embeddable.url = image.url();
            embeddable.alt = image.alt();
            embeddable.sortOrder = image.sortOrder();
            return embeddable;
        }

        ProductImage toDomain() {
            return new ProductImage(url, alt, sortOrder);
        }
    }
}
