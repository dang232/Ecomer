package com.vnshop.searchservice.application;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

public record SearchV2Query(
        String query,
        String category,
        String brand,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        Float minRating,
        List<String> tags,
        CursorSort sort,
        Boolean sameDay,
        Boolean verifiedOnly,
        Boolean officialOnly,
        String cursor,
        int limit,
        boolean includeFacets
) {
    public SearchV2Query {
        query = normalize(query);
        category = normalize(category);
        brand = normalize(brand);
        tags = normalizeTags(tags);
        if (minPrice != null && minPrice.signum() < 0) {
            throw new IllegalArgumentException("minPrice must be non-negative");
        }
        if (maxPrice != null && maxPrice.signum() < 0) {
            throw new IllegalArgumentException("maxPrice must be non-negative");
        }
        if (minRating != null && (minRating < 0 || minRating > 5)) {
            throw new IllegalArgumentException("minRating must be between 0 and 5");
        }
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new IllegalArgumentException("minPrice cannot exceed maxPrice");
        }
        if (sort == null) {
            sort = CursorSort.NEWEST;
        }
        if (limit < 1 || limit > 50) {
            throw new IllegalArgumentException("limit must be between 1 and 50");
        }
        cursor = normalize(cursor);
    }

    public String canonicalFilters() {
        return String.join("|",
                value(query),
                value(category),
                value(brand),
                decimal(minPrice),
                decimal(maxPrice),
                decimal(minRating),
                String.join(",", tags),
                sort.wireValue(),
                Boolean.toString(Boolean.TRUE.equals(sameDay)),
                Boolean.toString(Boolean.TRUE.equals(verifiedOnly)),
                Boolean.toString(Boolean.TRUE.equals(officialOnly))
        );
    }

    public SearchV2Query(
            String query,
            String category,
            String brand,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            CursorSort sort,
            Boolean sameDay,
            Boolean verifiedOnly,
            Boolean officialOnly,
            String cursor,
            int limit,
            boolean includeFacets) {
        this(query, category, brand, minPrice, maxPrice, null, List.of(), sort,
                sameDay, verifiedOnly, officialOnly, cursor, limit, includeFacets);
    }

    private static String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().replaceAll("\\s+", " ");
    }

    private static List<String> normalizeTags(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(value -> value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT))
                .distinct()
                .sorted()
                .toList();
    }

    private static String value(String value) {
        return value == null ? "" : value;
    }

    private static String decimal(BigDecimal value) {
        return value == null ? "" : value.stripTrailingZeros().toPlainString();
    }

    private static String decimal(Float value) {
        return value == null ? "" : BigDecimal.valueOf(value.doubleValue()).stripTrailingZeros().toPlainString();
    }
}
