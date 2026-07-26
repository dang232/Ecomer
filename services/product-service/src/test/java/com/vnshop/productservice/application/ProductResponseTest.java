package com.vnshop.productservice.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.ProductTag;
import com.vnshop.productservice.domain.review.ProductReviewSummary;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProductResponseTest {

    @Test
    void includesPublishedReviewSummary() {
        Product product = new Product(
                UUID.randomUUID(),
                "seller-rating",
                "Rated product",
                null,
                "electronics",
                "Brand",
                List.of(new ProductVariant("sku", "Default", new Money(new BigDecimal("100")), null, 1)),
                List.of()
        );

        ProductResponse response = ProductResponse.fromDomain(product, new ProductReviewSummary(4.0, 1));

        assertThat(response.rating()).isEqualTo(4.0);
        assertThat(response.reviewCount()).isEqualTo(1);
    }

    @Test
    void sumsStockAcrossVariants() {
        Product product = new Product(
                UUID.randomUUID(),
                "seller-1",
                "Hoodie",
                "warm",
                "apparel",
                "vnshop",
                List.of(
                        new ProductVariant("hoodie-s", "S", new Money(new BigDecimal("250000")), null, 3),
                        new ProductVariant("hoodie-m", "M", new Money(new BigDecimal("250000")), null, 7),
                        new ProductVariant("hoodie-l", "L", new Money(new BigDecimal("250000")), null, 0)
                ),
                List.of()
        );

        ProductResponse response = ProductResponse.fromDomain(product);

        assertThat(response.stock()).isEqualTo(10);
        assertThat(response.variants())
                .extracting(ProductResponse.VariantResponse::stockQuantity)
                .containsExactly(3, 7, 0);
    }

    @Test
    void zeroStockWhenNoVariants() {
        Product product = new Product(
                UUID.randomUUID(),
                "seller-2",
                "Mug",
                null,
                "kitchen",
                null,
                List.of(),
                List.of()
        );

        ProductResponse response = ProductResponse.fromDomain(product);

        assertThat(response.stock()).isZero();
        assertThat(response.variants()).isEmpty();
    }

    @Test
    void legacyVariantConstructorDefaultsToZeroStock() {
        ProductVariant legacy = new ProductVariant("legacy-1", "legacy", new Money(new BigDecimal("100000")), null);

        Product product = new Product(
                UUID.randomUUID(),
                "seller-3",
                "Legacy",
                null,
                null,
                null,
                List.of(legacy),
                List.of()
        );

        ProductResponse response = ProductResponse.fromDomain(product);

        assertThat(response.stock()).isZero();
        assertThat(response.variants()).singleElement()
                .extracting(ProductResponse.VariantResponse::stockQuantity)
                .isEqualTo(0);
    }

    @Test
    void exposesPublicTagLabels() {
        Product product = new Product(
                UUID.randomUUID(), "seller-4", "Wireless headphones", null, "audio", "Brand",
                List.of(), List.of(), List.of(new ProductTag("wireless", "Wireless")), false, false, false);

        assertThat(ProductResponse.fromDomain(product).tags()).containsExactly("Wireless");
    }
}
