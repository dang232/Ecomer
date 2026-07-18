package com.vnshop.searchservice.infrastructure.persistence;

import com.vnshop.searchservice.application.SearchFacetsResponse;
import com.vnshop.searchservice.application.SearchRepository;
import com.vnshop.searchservice.application.CursorSort;
import com.vnshop.searchservice.application.SearchCursor;
import com.vnshop.searchservice.domain.ProductReadModel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

/**
 * JPA-backed implementation of {@link SearchRepository}. Kept alongside the
 * Elasticsearch adapter so it can be used as a fallback or in local dev without
 * an ES instance. The ES adapter is marked {@code @Primary} so Spring prefers it
 * when both are available.
 */
@Repository
public class JpaSearchAdapter implements SearchRepository {

    private final ProductReadModelRepository repository;

    public JpaSearchAdapter(ProductReadModelRepository repository) {
        this.repository = repository;
    }

    @Override
    public Page<ProductReadModel> searchPaged(
            String query, String categoryId, String brand,
            BigDecimal minPrice, BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly,
            Pageable pageable) {
        return repository.searchPaged(query, categoryId, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly, pageable);
    }

    @Override
    public List<ProductReadModel> searchAfter(
            String query, String categoryId, String brand,
            BigDecimal minPrice, BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly,
            CursorSort sort, SearchCursor cursor, int limit) {
        Pageable pageable = Pageable.ofSize(limit);
        String normalizedQuery = blankToNull(query);
        String normalizedCategory = blankToNull(categoryId);
        String normalizedBrand = blankToNull(brand);
        List<ProductReadModelJpaEntity> entities = switch (sort) {
            case NEWEST -> repository.searchAfterNewest(
                    normalizedQuery, normalizedCategory, normalizedBrand, minPrice, maxPrice,
                    sameDay, verifiedOnly, officialOnly,
                    cursor == null ? null : cursor.createdAt(),
                    cursor == null ? null : cursor.productId(), pageable);
            case PRICE_LOW -> repository.searchAfterPriceLow(
                    normalizedQuery, normalizedCategory, normalizedBrand, minPrice, maxPrice,
                    sameDay, verifiedOnly, officialOnly,
                    cursor == null ? null : cursor.price(),
                    cursor == null ? null : cursor.productId(), pageable);
            case PRICE_HIGH -> repository.searchAfterPriceHigh(
                    normalizedQuery, normalizedCategory, normalizedBrand, minPrice, maxPrice,
                    sameDay, verifiedOnly, officialOnly,
                    cursor == null ? null : cursor.price(),
                    cursor == null ? null : cursor.productId(), pageable);
        };
        return entities.stream().map(ProductReadModelJpaEntity::toDomain).toList();
    }

    @Override
    public List<String> findDistinctCategories() {
        return repository.findDistinctCategories();
    }

    @Override
    public List<String> suggestions(String prefix, Pageable pageable) {
        return repository.suggestions(prefix, pageable);
    }

    @Override
    public List<SearchFacetsResponse.FacetEntry> categoryFacetsFor(
            String query, String brand, BigDecimal minPrice, BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        return toFacetEntries(repository.categoryFacetsFor(query, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly));
    }

    @Override
    public List<SearchFacetsResponse.FacetEntry> brandFacetsFor(
            String query, String categoryId, BigDecimal minPrice, BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        return toFacetEntries(repository.brandFacetsFor(query, categoryId, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly));
    }

    private static List<SearchFacetsResponse.FacetEntry> toFacetEntries(List<Object[]> rows) {
        return rows.stream()
                .map(row -> new SearchFacetsResponse.FacetEntry((String) row[0], ((Number) row[1]).longValue()))
                .toList();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
