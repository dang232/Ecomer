package com.vnshop.searchservice.infrastructure.web;

import com.vnshop.searchservice.application.SearchFacetsResponse;
import com.vnshop.searchservice.application.SearchProductResponse;
import com.vnshop.searchservice.application.SearchProductsUseCase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping
public class SearchController {
    /**
     * Whitelist of sort keys the FE may pass via {@code ?sort=}. Unknown
     * values fall through to {@link #DEFAULT_SORT} (createdAt desc) so a
     * stale FE never produces a 500. Values mirror the FE sortBy enum on
     * SearchPage.tsx (price-low, price-high, rating, newest).
     *
     * <p>{@code rating} is currently mapped to the default sort because the
     * read model doesn't carry a rating column yet — the BE accepts the
     * key without 500'ing, the actual rating-aware ranking lands when the
     * read-model schema gains the column.
     */
    private static final Map<String, Sort> SORT_BY = Map.of(
            "price-low", Sort.by(Sort.Direction.ASC, "minPrice"),
            "price-high", Sort.by(Sort.Direction.DESC, "minPrice"),
            "newest", Sort.by(Sort.Direction.DESC, "createdAt"),
            "rating", Sort.by(Sort.Direction.DESC, "createdAt"),
            "popular", Sort.by(Sort.Direction.DESC, "createdAt")
    );
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt");

    private final SearchProductsUseCase searchProductsUseCase;

    public SearchController(SearchProductsUseCase searchProductsUseCase) {
        this.searchProductsUseCase = searchProductsUseCase;
    }

    @GetMapping("/search")
    public ApiResponse<Page<SearchProductResponse>> search(
            @RequestParam(name = "q", required = false) String query,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) String sort,
            @RequestParam(name = "sameDay", required = false) Boolean sameDay,
            @RequestParam(name = "verifiedOnly", required = false) Boolean verifiedOnly,
            @RequestParam(name = "officialOnly", required = false) Boolean officialOnly,
            Pageable pageable
    ) {
        Pageable resolved = PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                resolveSort(sort)
        );
        return ApiResponse.ok(searchProductsUseCase.searchPaged(query, category, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly, resolved));
    }

    @GetMapping("/categories")
    public ApiResponse<List<String>> categories() {
        return ApiResponse.ok(searchProductsUseCase.categories());
    }

    /**
     * Header autocomplete: returns up to 10 product names whose lower-cased
     * value starts with the prefix. Empty/missing prefix returns an empty list
     * rather than the full catalog.
     */
    @GetMapping("/search/suggest")
    public ApiResponse<List<String>> suggest(@RequestParam(name = "q", required = false) String query) {
        return ApiResponse.ok(searchProductsUseCase.suggest(query));
    }

    /**
     * Facet aggregations alongside a search query. Each axis (category, brand)
     * is computed with the other axis relaxed so the sidebar shows other-axis
     * options without forcing the user to unselect their current filter.
     */
    @GetMapping("/search/facets")
    public ApiResponse<SearchFacetsResponse> facets(
            @RequestParam(name = "q", required = false) String query,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(name = "sameDay", required = false) Boolean sameDay,
            @RequestParam(name = "verifiedOnly", required = false) Boolean verifiedOnly,
            @RequestParam(name = "officialOnly", required = false) Boolean officialOnly
    ) {
        return ApiResponse.ok(searchProductsUseCase.facets(query, category, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly));
    }

    private static Sort resolveSort(String key) {
        if (key == null || key.isBlank()) {
            return DEFAULT_SORT;
        }
        return SORT_BY.getOrDefault(key, DEFAULT_SORT);
    }
}
