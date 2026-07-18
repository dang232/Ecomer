package com.vnshop.searchservice.application;

import com.vnshop.searchservice.domain.ProductReadModel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.ArrayList;

public class SearchProductsUseCase {

    private static final int MAX_SUGGESTIONS = 10;

    private final SearchRepository searchRepository;
    private final SearchCursorCodec cursorCodec;

    public SearchProductsUseCase(SearchRepository searchRepository) {
        this(searchRepository, new SearchCursorCodec(
                System.getenv().getOrDefault("VNSHOP_SEARCH_CURSOR_SECRET", "local-search-cursor-secret-change-me")));
    }

    public SearchProductsUseCase(SearchRepository searchRepository, SearchCursorCodec cursorCodec) {
        this.searchRepository = searchRepository;
        this.cursorCodec = cursorCodec;
    }

    public Page<SearchProductResponse> searchPaged(String query, String category, String brand, BigDecimal minPrice, BigDecimal maxPrice, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly, Pageable pageable) {
        return searchRepository.searchPaged(query, category, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly, pageable)
                .map(SearchProductResponse::fromDomain);
    }

    public SearchV2Response searchV2(SearchV2Query query) {
        SearchCursor cursor = cursorCodec.decode(query.cursor(), query);
        List<ProductReadModel> rows = searchRepository.searchAfter(
                query.query(), query.category(), query.brand(), query.minPrice(), query.maxPrice(),
                query.sameDay(), query.verifiedOnly(), query.officialOnly(), query.sort(), cursor, query.limit() + 1);
        boolean hasMore = rows.size() > query.limit();
        List<ProductReadModel> page = hasMore ? new ArrayList<>(rows.subList(0, query.limit())) : rows;
        String nextCursor = hasMore ? cursorCodec.encode(query, page.getLast()) : null;
        SearchFacetsResponse facets = query.includeFacets()
                ? facets(query.query(), query.category(), query.brand(), query.minPrice(), query.maxPrice(), query.sameDay(), query.verifiedOnly(), query.officialOnly())
                : null;
        return new SearchV2Response(page.stream().map(SearchProductResponse::fromDomain).toList(), nextCursor, hasMore, facets);
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
