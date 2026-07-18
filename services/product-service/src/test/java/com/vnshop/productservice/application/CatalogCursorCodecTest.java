package com.vnshop.productservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.productservice.domain.CatalogProduct;
import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductVariant;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CatalogCursorCodecTest {
    private final CatalogCursorCodec codec = new CatalogCursorCodec("catalog-test-secret");

    @Test
    void roundTripsAndBindsCursorToCanonicalFilters() {
        CatalogV2Query query = new CatalogV2Query(" phone ", null, null, null, null,
                CatalogCursorSort.NEWEST, null, null, null, null, 24, false);
        CatalogProduct product = product(UUID.randomUUID(), Instant.parse("2026-07-18T10:00:00Z"), BigDecimal.TEN);

        String token = codec.encode(query, product);
        CatalogCursor cursor = codec.decode(token, new CatalogV2Query("phone", null, null, null, null,
                CatalogCursorSort.NEWEST, null, null, null, null, 50, true));

        assertThat(cursor.createdAt()).isEqualTo(product.createdAt());
        assertThat(cursor.productId()).isEqualTo(product.product().productId().toString());
        assertThat(token).doesNotContain("phone");
    }

    @Test
    void rejectsChangedFilters() {
        CatalogV2Query query = new CatalogV2Query("phone", null, null, null, null,
                CatalogCursorSort.PRICE_LOW, null, null, null, null, 24, false);
        String token = codec.encode(query, product(UUID.randomUUID(), Instant.now(), BigDecimal.TEN));
        CatalogV2Query changed = new CatalogV2Query("tablet", null, null, null, null,
                CatalogCursorSort.PRICE_LOW, null, null, null, token, 24, false);

        assertThatThrownBy(() -> codec.decode(token, changed))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("filters");
    }

    private static CatalogProduct product(UUID id, Instant createdAt, BigDecimal price) {
        Product domain = new Product(id, "seller-1", "Phone", "desc", "electronics", "Acme",
                List.of(new ProductVariant("sku-1", "Default", new Money(price), null, 1)), List.of());
        return new CatalogProduct(domain, createdAt, price);
    }
}
