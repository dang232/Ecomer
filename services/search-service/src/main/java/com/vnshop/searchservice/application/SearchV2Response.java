package com.vnshop.searchservice.application;

import java.util.List;

public record SearchV2Response(
        List<SearchProductResponse> items,
        String nextCursor,
        boolean hasMore,
        SearchFacetsResponse facets
) {
    public SearchV2Response {
        items = items == null ? List.of() : List.copyOf(items);
    }
}
