package com.vnshop.productservice.application;

import java.util.List;

public record CatalogV2Response(List<ProductResponse> items, String nextCursor, boolean hasMore) {
    public CatalogV2Response {
        items = items == null ? List.of() : List.copyOf(items);
    }
}
