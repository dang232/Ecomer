package com.vnshop.searchservice.application;

import java.util.List;

public record SearchFacetsResponse(
        List<FacetEntry> categories,
        List<FacetEntry> brands,
        List<FacetEntry> tags
) {
    public SearchFacetsResponse(List<FacetEntry> categories, List<FacetEntry> brands) {
        this(categories, brands, List.of());
    }

    public record FacetEntry(String key, String label, long count) {
        public FacetEntry(String key, long count) {
            this(key, key, count);
        }
    }
}
