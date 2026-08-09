package com.vnshop.productservice.infrastructure.web;

import java.util.List;

public record AdminCursorPage<T>(
        List<T> items,
        String nextCursor,
        boolean hasMore,
        int pageSize,
        Sort sort,
        Snapshot snapshot) {
    public record Sort(String field, String direction) {}
    public record Snapshot(String asOf) {}
}
