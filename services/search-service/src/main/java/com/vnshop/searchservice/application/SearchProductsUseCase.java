package com.vnshop.searchservice.application;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;

public class SearchProductsUseCase {

    private static final int MAX_SUGGESTIONS = 10;

    private final SearchRepository searchRepository;

    public SearchProductsUseCase(SearchRepository searchRepository) {
        this.searchRepository = searchRepository;
    }

    public Page<SearchProductResponse> searchPaged(String query, String category, String brand, BigDecimal minPrice, BigDecimal maxPrice, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly, Pageable pageable) {
        return searchRepository.searchPaged(query, category, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly, pageable)
                .map(SearchProductResponse::fromDomain);
    }

    public List<String> categories() {
        return searchRepository.findDistinctCategories();
    }

    /** Returns up to {@value #MAX_SUGGESTIONS} product names that start with the prefix. */
    public List<String> suggest(String prefix) {
        return searchRepository.suggestions(prefix, PageRequest.of(0, MAX_SUGGESTIONS));
    }

    /**
     * Returns category and brand facet aggregations for the same filter set the
     * caller would pass to {@link #searchPaged}. Each facet dimension is computed
     * with the OTHER filter relaxed so the user can see their other-axis options
     * without unselecting the current one (typical e-commerce facet UX).
     */
    public SearchFacetsResponse facets(String query, String category, String brand, BigDecimal minPrice, BigDecimal maxPrice, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        return new SearchFacetsResponse(
                searchRepository.categoryFacetsFor(query, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly),
                searchRepository.brandFacetsFor(query, category, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly)
        );
    }
}
