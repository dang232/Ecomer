package com.vnshop.searchservice.application;

import com.vnshop.searchservice.domain.ProductReadModel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;

/**
 * Output port for the search use case. Implementations live in the
 * infrastructure layer (JPA or Elasticsearch) and are injected via Spring.
 */
public interface SearchRepository {

    /** Returns at most {@code limit} plus one row, using the supplied keyset cursor. */
    List<ProductReadModel> searchAfter(
            String query,
            String categoryId,
            String brand,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Boolean sameDay,
            Boolean verifiedOnly,
            Boolean officialOnly,
            CursorSort sort,
            SearchCursor cursor,
            int limit
    );

    default List<ProductReadModel> searchAfter(
            String query, String categoryId, String brand, BigDecimal minPrice, BigDecimal maxPrice,
            Float minRating, List<String> tags, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly,
            CursorSort sort, SearchCursor cursor, int limit) {
        if (minRating == null && (tags == null || tags.isEmpty())) {
            return searchAfter(query, categoryId, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly,
                    sort, cursor, limit);
        }
        throw new UnsupportedOperationException("dynamic search filters are not supported by this adapter");
    }

    /**
     * Full-text / filtered search returning a page of domain read models.
     * All parameters are nullable; null means "no filter on that dimension".
     */
    Page<ProductReadModel> searchPaged(
            String query,
            String categoryId,
            String brand,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Boolean sameDay,
            Boolean verifiedOnly,
            Boolean officialOnly,
            Pageable pageable
    );

    default Page<ProductReadModel> searchPaged(
            String query, String categoryId, String brand, BigDecimal minPrice, BigDecimal maxPrice,
            Float minRating, List<String> tags, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly,
            Pageable pageable) {
        if (minRating == null && (tags == null || tags.isEmpty())) {
            return searchPaged(query, categoryId, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly, pageable);
        }
        throw new UnsupportedOperationException("dynamic search filters are not supported by this adapter");
    }

    /** Returns all distinct non-null category IDs present in the index. */
    List<String> findDistinctCategories();

    /**
     * Prefix-match suggestions on product name. The {@code prefix} is
     * guaranteed to be non-blank by the use case before this is called.
     */
    List<String> suggestions(String prefix, Pageable pageable);

    /**
     * Category facet counts matching the given filters (brand filter applied,
     * categoryId filter relaxed — standard e-commerce sidebar UX).
     */
    List<SearchFacetsResponse.FacetEntry> categoryFacetsFor(
            String query, String brand, BigDecimal minPrice, BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly);

    /**
     * Brand facet counts matching the given filters (categoryId filter applied,
     * brand filter relaxed).
     */
    List<SearchFacetsResponse.FacetEntry> brandFacetsFor(
            String query, String categoryId, BigDecimal minPrice, BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly);

    default List<SearchFacetsResponse.FacetEntry> categoryFacetsFor(
            String query, String brand, BigDecimal minPrice, BigDecimal maxPrice, Float minRating, List<String> tags,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        if (minRating == null && (tags == null || tags.isEmpty())) {
            return categoryFacetsFor(query, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly);
        }
        throw new UnsupportedOperationException("dynamic facet filters are not supported by this adapter");
    }

    default List<SearchFacetsResponse.FacetEntry> brandFacetsFor(
            String query, String categoryId, BigDecimal minPrice, BigDecimal maxPrice, Float minRating, List<String> tags,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        if (minRating == null && (tags == null || tags.isEmpty())) {
            return brandFacetsFor(query, categoryId, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly);
        }
        throw new UnsupportedOperationException("dynamic facet filters are not supported by this adapter");
    }

    default List<SearchFacetsResponse.FacetEntry> tagFacetsFor(
            String query, String categoryId, String brand, BigDecimal minPrice, BigDecimal maxPrice, Float minRating,
            List<String> tags, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        return List.of();
    }
}
