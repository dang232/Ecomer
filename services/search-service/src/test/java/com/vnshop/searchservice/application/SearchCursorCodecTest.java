package com.vnshop.searchservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.searchservice.domain.ProductReadModel;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class SearchCursorCodecTest {

    private final SearchCursorCodec codec = new SearchCursorCodec("cursor-test-secret");

    @Test
    void roundTripsNewestCursorAndBindsItToCanonicalFilters() {
        SearchV2Query query = new SearchV2Query(
                "  phone  ", null, null, null, null, CursorSort.NEWEST,
                null, null, null, null, 24, false);
        ProductReadModel product = product("p1", Instant.parse("2026-07-18T10:00:00Z"), BigDecimal.TEN);

        String token = codec.encode(query, product);
        SearchCursor decoded = codec.decode(token, new SearchV2Query(
                "phone", null, null, null, null, CursorSort.NEWEST,
                null, null, null, null, 50, true));

        assertThat(decoded.sort()).isEqualTo(CursorSort.NEWEST);
        assertThat(decoded.createdAt()).isEqualTo(product.createdAt());
        assertThat(decoded.productId()).isEqualTo("p1");
        assertThat(token).doesNotContain("phone");
    }

    @Test
    void rejectsTamperingAndFilterChanges() {
        SearchV2Query query = new SearchV2Query(
                "phone", null, null, null, null, CursorSort.PRICE_LOW,
                null, null, null, null, 24, false);
        String token = codec.encode(query, product("p1", Instant.now(), BigDecimal.TEN));

        assertThatThrownBy(() -> codec.decode(token + "x", query))
                .isInstanceOf(IllegalArgumentException.class);
        SearchV2Query changed = new SearchV2Query(
                "tablet", null, null, null, null, CursorSort.PRICE_LOW,
                null, null, null, token, 24, false);
        assertThatThrownBy(() -> codec.decode(token, changed))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("filters");
    }

    private static ProductReadModel product(String id, Instant createdAt, BigDecimal price) {
        return new ProductReadModel(id, "Phone", "desc", "electronics", "Acme", "ACTIVE",
                price, price, 1, null, 1, createdAt, false, false, false);
    }
}
