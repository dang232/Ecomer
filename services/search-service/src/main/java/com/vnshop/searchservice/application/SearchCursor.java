package com.vnshop.searchservice.application;

import java.math.BigDecimal;
import java.time.Instant;

public record SearchCursor(
        CursorSort sort,
        String filterHash,
        Instant createdAt,
        BigDecimal price,
        String productId
) {
    public SearchCursor {
        if (sort == null || filterHash == null || filterHash.isBlank() || productId == null || productId.isBlank()) {
            throw new IllegalArgumentException("cursor is incomplete");
        }
        if (sort == CursorSort.NEWEST && createdAt == null) {
            throw new IllegalArgumentException("newest cursor requires createdAt");
        }
        if (sort != CursorSort.NEWEST && price == null) {
            throw new IllegalArgumentException("price cursor requires price");
        }
    }
}
