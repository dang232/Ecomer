package com.vnshop.productservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.domain.CatalogProduct;
import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GetProductUseCaseV2Test {
    private final ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
    private final GetProductUseCase useCase = new GetProductUseCase(repository);
    private final CatalogCursorCodec codec = new CatalogCursorCodec("test-product-secret");

    @Test
    void returnsPagePlusCursorWithoutChangingLegacyResponse() {
        CatalogV2Query query = new CatalogV2Query("phone", null, null, null, null,
                CatalogCursorSort.NEWEST, null, null, null, null, 1, false);
        CatalogProduct first = product(UUID.randomUUID(), Instant.parse("2026-07-18T10:00:00Z"));
        CatalogProduct second = product(UUID.randomUUID(), Instant.parse("2026-07-18T09:00:00Z"));
        when(repository.findCatalogAfter(eq(null), eq("phone"), eq(null), isNull(), isNull(),
                isNull(), isNull(), isNull(), eq(CatalogCursorSort.NEWEST), isNull(), eq(2)))
                .thenReturn(List.of(first, second));

        CatalogV2Response response = useCase.findCatalogV2(query, codec);

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().getFirst().id()).isEqualTo(first.product().productId().toString());
        assertThat(response.hasMore()).isTrue();
        assertThat(response.nextCursor()).isNotBlank();
    }

    @Test
    void rejectsCursorBoundToDifferentFilters() {
        CatalogV2Query original = new CatalogV2Query("phone", null, null, null, null,
                CatalogCursorSort.NEWEST, null, null, null, null, 1, false);
        CatalogProduct first = product(UUID.randomUUID(), Instant.parse("2026-07-18T10:00:00Z"));
        CatalogProduct second = product(UUID.randomUUID(), Instant.parse("2026-07-18T09:00:00Z"));
        when(repository.findCatalogAfter(any(), any(), any(), any(), any(), any(), any(), any(),
                eq(CatalogCursorSort.NEWEST), isNull(), eq(2))).thenReturn(List.of(first, second));
        String cursor = useCase.findCatalogV2(original, codec).nextCursor();

        CatalogV2Query changed = new CatalogV2Query("tablet", null, null, null, null,
                CatalogCursorSort.NEWEST, null, null, null, cursor, 1, false);
        assertThatThrownBy(() -> useCase.findCatalogV2(changed, codec))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("filters");
    }

    private static CatalogProduct product(UUID id, Instant createdAt) {
        Product domain = new Product(id, "seller-1", "Phone", "desc", "electronics", "Acme",
                List.of(new ProductVariant("sku-1", "Default", new Money(BigDecimal.TEN), null, 1)), List.of());
        return new CatalogProduct(domain, createdAt, BigDecimal.TEN);
    }
}
