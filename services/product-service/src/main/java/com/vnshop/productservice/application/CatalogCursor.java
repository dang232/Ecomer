package com.vnshop.productservice.application;

import java.math.BigDecimal;
import java.time.Instant;

public record CatalogCursor(
        CatalogCursorSort sort,
        String filterHash,
        Instant createdAt,
        BigDecimal price,
        String productId
) {
    public CatalogCursor {
        if (sort == null || filterHash == null || filterHash.isBlank() || productId == null || productId.isBlank()) {
            throw new IllegalArgumentException("cursor is incomplete");
        }
        if (sort == CatalogCursorSort.NEWEST && createdAt == null) {
            throw new IllegalArgumentException("newest cursor requires createdAt");
        }
        if (sort != CatalogCursorSort.NEWEST && price == null) {
            throw new IllegalArgumentException("price cursor requires price");
        }
    }
}
