package com.vnshop.productservice.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.ParcelDimensions;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductVariant;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProductVariantParcelMappingTest {
    @Test
    void validParcelPersists() {
        Product product = productWithVariant(new ProductVariant(
                "SKU-DEFAULT", "Default", new Money(new BigDecimal("125000")), null, 1));

        ProductJpaEntity mapped = ProductJpaEntity.fromDomain(product);

        ProductVariant restored = mapped.toDomain().variants().getFirst();
        assertThat(restored.parcel()).isEqualTo(new ParcelDimensions(1000, 300, 200, 100, 125000));
    }

    @Test
    void variantOverrideWins() {
        Product product = productWithVariant(new ProductVariant(
                "SKU-OVERRIDE", "Override", new Money(new BigDecimal("125000")), null, 1,
                new ParcelDimensions(1500, 500, 400, 300, 777000)));

        ProductJpaEntity mapped = ProductJpaEntity.fromDomain(product);

        assertThat(mapped.toDomain().variants().getFirst().parcel())
                .isEqualTo(new ParcelDimensions(1500, 500, 400, 300, 777000));
    }

    @Test
    void variantOverrideCanDeclareZeroValue() {
        Product product = productWithVariant(new ProductVariant(
                "SKU-FREE", "Free", new Money(new BigDecimal("125000")), null, 1,
                new ParcelDimensions(1500, 500, 400, 300, 0)));

        assertThat(ProductJpaEntity.fromDomain(product).toDomain().variants().getFirst().parcel())
                .isEqualTo(new ParcelDimensions(1500, 500, 400, 300, 0));
    }

    @Test
    void negativeDimensionsReject() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> new ParcelDimensions(
                1500, -1, 400, 300, 777000))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static Product productWithVariant(ProductVariant variant) {
        return new Product(UUID.randomUUID(), "seller", "Product", null, null, null,
                List.of(variant), List.of());
    }
}
