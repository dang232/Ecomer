package com.vnshop.productservice.application;

import java.math.BigDecimal;

public record CatalogV2Query(
        String query,
        String category,
        String brand,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        CatalogCursorSort sort,
        Boolean sameDay,
        Boolean verifiedOnly,
        Boolean officialOnly,
        String cursor,
        int limit,
        boolean includeFacets
) {
    public CatalogV2Query {
        query = normalize(query);
        category = normalize(category);
        brand = normalize(brand);
        if (minPrice != null && minPrice.signum() < 0 || maxPrice != null && maxPrice.signum() < 0) {
            throw new IllegalArgumentException("prices must be non-negative");
        }
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new IllegalArgumentException("minPrice cannot exceed maxPrice");
        }
        if (sort == null) {
            sort = CatalogCursorSort.NEWEST;
        }
        if (limit < 1 || limit > 50) {
            throw new IllegalArgumentException("limit must be between 1 and 50");
        }
        cursor = normalize(cursor);
    }

    public String canonicalFilters() {
        return String.join("|", value(query), value(category), value(brand), decimal(minPrice), decimal(maxPrice),
                sort.wireValue(), Boolean.toString(Boolean.TRUE.equals(sameDay)),
                Boolean.toString(Boolean.TRUE.equals(verifiedOnly)), Boolean.toString(Boolean.TRUE.equals(officialOnly)));
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim().replaceAll("\\s+", " ");
    }

    private static String value(String value) { return value == null ? "" : value; }

    private static String decimal(BigDecimal value) {
        return value == null ? "" : value.stripTrailingZeros().toPlainString();
    }
}
