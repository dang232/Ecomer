package com.vnshop.searchservice.infrastructure.persistence;

import com.vnshop.searchservice.application.SearchFacetsResponse;
import com.vnshop.searchservice.application.SearchRepository;
import com.vnshop.searchservice.application.CursorSort;
import com.vnshop.searchservice.application.SearchCursor;
import com.vnshop.searchservice.domain.ProductReadModel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
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
        if (cursor == null) {
            Sort initialSort = switch (sort) {
                case NEWEST -> Sort.by(Sort.Direction.DESC, "createdAt");
                case PRICE_LOW -> Sort.by(Sort.Direction.ASC, "minPrice");
                case PRICE_HIGH -> Sort.by(Sort.Direction.DESC, "minPrice");
            };
            return repository.searchPaged(
                    normalizedQuery, normalizedCategory, normalizedBrand,
                    minPrice, maxPrice, sameDay, verifiedOnly, officialOnly,
                    PageRequest.of(0, limit, initialSort)).getContent();
        }
        List<ProductReadModelJpaEntity> entities = switch (sort) {
            case NEWEST -> repository.searchAfterNewest(
                    normalizedQuery, normalizedCategory, normalizedBrand, minPrice, maxPrice,
                    sameDay, verifiedOnly, officialOnly,
                    cursor.createdAt(), cursor.productId(), pageable);
            case PRICE_LOW -> repository.searchAfterPriceLow(
                    normalizedQuery, normalizedCategory, normalizedBrand, minPrice, maxPrice,
                    sameDay, verifiedOnly, officialOnly,
                    cursor.price(), cursor.productId(), pageable);
            case PRICE_HIGH -> repository.searchAfterPriceHigh(
                    normalizedQuery, normalizedCategory, normalizedBrand, minPrice, maxPrice,
                    sameDay, verifiedOnly, officialOnly,
                    cursor.price(), cursor.productId(), pageable);
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

    @Override
    public Page<ProductReadModel> searchPaged(
            String query, String categoryId, String brand, BigDecimal minPrice, BigDecimal maxPrice,
            Float minRating, List<String> tags, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly,
            Pageable pageable) {
        List<ProductReadModel> rows = matching(query, categoryId, brand, minPrice, maxPrice, minRating, tags,
                sameDay, verifiedOnly, officialOnly);
        rows = new java.util.ArrayList<>(rows);
        rows.sort(pageableComparator(pageable));
        int start = Math.toIntExact(pageable.getOffset());
        if (start >= rows.size()) {
            return new PageImpl<>(List.of(), pageable, rows.size());
        }
        int end = Math.min(start + pageable.getPageSize(), rows.size());
        return new PageImpl<>(rows.subList(start, end), pageable, rows.size());
    }

    @Override
    public List<ProductReadModel> searchAfter(
            String query, String categoryId, String brand, BigDecimal minPrice, BigDecimal maxPrice,
            Float minRating, List<String> tags, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly,
            CursorSort sort, SearchCursor cursor, int limit) {
        List<ProductReadModel> rows = matching(query, categoryId, brand, minPrice, maxPrice, minRating, tags,
                sameDay, verifiedOnly, officialOnly);
        rows = new java.util.ArrayList<>(rows);
        rows.sort(cursorComparator(sort));
        if (cursor != null) {
            rows.removeIf(row -> !isAfter(row, sort, cursor));
        }
        return rows.subList(0, Math.min(limit, rows.size()));
    }

    @Override
    public List<SearchFacetsResponse.FacetEntry> categoryFacetsFor(
            String query, String brand, BigDecimal minPrice, BigDecimal maxPrice, Float minRating, List<String> tags,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        return facetEntries(matching(query, null, brand, minPrice, maxPrice, minRating, tags,
                sameDay, verifiedOnly, officialOnly), ProductReadModel::categoryId);
    }

    @Override
    public List<SearchFacetsResponse.FacetEntry> brandFacetsFor(
            String query, String categoryId, BigDecimal minPrice, BigDecimal maxPrice, Float minRating, List<String> tags,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        return facetEntries(matching(query, categoryId, null, minPrice, maxPrice, minRating, tags,
                sameDay, verifiedOnly, officialOnly), ProductReadModel::brand);
    }

    @Override
    public List<SearchFacetsResponse.FacetEntry> tagFacetsFor(
            String query, String categoryId, String brand, BigDecimal minPrice, BigDecimal maxPrice, Float minRating,
            List<String> tags, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        List<ProductReadModel> rows = matching(query, categoryId, brand, minPrice, maxPrice, minRating, List.of(),
                sameDay, verifiedOnly, officialOnly);
        return rows.stream()
                .flatMap(row -> row.tags().stream())
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry::getKey))
                .map(entry -> new SearchFacetsResponse.FacetEntry(entry.getKey(), entry.getValue()))
                .toList();
    }

    private List<ProductReadModel> matching(
            String query, String categoryId, String brand, BigDecimal minPrice, BigDecimal maxPrice,
            Float minRating, List<String> tags, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        List<String> normalizedTags = tags == null || tags.isEmpty() ? List.of("__no_tag__") : tags;
        boolean tagsEmpty = tags == null || tags.isEmpty();
        return repository.findMatchingDynamic(blankToNull(query), blankToNull(categoryId), blankToNull(brand),
                        minPrice, maxPrice, minRating, tagsEmpty, normalizedTags, sameDay, verifiedOnly, officialOnly)
                .stream().map(ProductReadModelJpaEntity::toDomain).toList();
    }

    private static List<SearchFacetsResponse.FacetEntry> facetEntries(
            List<ProductReadModel> rows, Function<ProductReadModel, String> keyExtractor) {
        return rows.stream()
                .map(keyExtractor)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry::getKey))
                .map(entry -> new SearchFacetsResponse.FacetEntry(entry.getKey(), entry.getValue()))
                .toList();
    }

    private static Comparator<ProductReadModel> pageableComparator(Pageable pageable) {
        if (pageable.getSort().isUnsorted()) {
            return cursorComparator(CursorSort.NEWEST);
        }
        Sort.Order order = pageable.getSort().iterator().next();
        CursorSort sort = switch (order.getProperty()) {
            case "minPrice" -> order.isAscending() ? CursorSort.PRICE_LOW : CursorSort.PRICE_HIGH;
            default -> CursorSort.NEWEST;
        };
        return cursorComparator(sort);
    }

    private static Comparator<ProductReadModel> cursorComparator(CursorSort sort) {
        Comparator<String> ids = Comparator.nullsLast(Comparator.naturalOrder());
        return switch (sort) {
            case NEWEST -> Comparator.comparing(ProductReadModel::createdAt,
                            Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(ProductReadModel::productId, ids.reversed());
            case PRICE_LOW -> Comparator.comparing(ProductReadModel::minPrice,
                            Comparator.nullsLast(Comparator.naturalOrder()))
                    .thenComparing(ProductReadModel::productId, ids);
            case PRICE_HIGH -> Comparator.comparing(ProductReadModel::minPrice,
                            Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(ProductReadModel::productId, ids.reversed());
        };
    }

    private static boolean isAfter(ProductReadModel row, CursorSort sort, SearchCursor cursor) {
        int primary = switch (sort) {
            case NEWEST -> Objects.compare(row.createdAt(), cursor.createdAt(), Comparator.nullsLast(Comparator.reverseOrder()));
            case PRICE_LOW -> Objects.compare(row.minPrice(), cursor.price(), Comparator.nullsLast(Comparator.naturalOrder()));
            case PRICE_HIGH -> Objects.compare(row.minPrice(), cursor.price(), Comparator.nullsLast(Comparator.reverseOrder()));
        };
        if (primary != 0) return primary > 0;
        return row.productId().compareTo(cursor.productId()) > 0;
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
