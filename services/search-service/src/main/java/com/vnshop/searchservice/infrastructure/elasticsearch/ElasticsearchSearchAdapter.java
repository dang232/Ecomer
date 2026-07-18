package com.vnshop.searchservice.infrastructure.elasticsearch;

import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import com.vnshop.searchservice.application.SearchFacetsResponse;
import com.vnshop.searchservice.application.SearchRepository;
import com.vnshop.searchservice.application.CursorSort;
import com.vnshop.searchservice.application.SearchCursor;
import com.vnshop.searchservice.domain.ProductReadModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchAggregation;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchAggregations;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.client.elc.NativeQueryBuilder;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Elasticsearch-backed implementation of {@link SearchRepository}.
 * Marked {@code @Primary} so Spring injects this in preference to the JPA adapter
 * when both are on the classpath.
 *
 * <p>Uses {@link ElasticsearchOperations} for complex BoolQuery + aggregation
 * queries, and {@link ProductElasticsearchRepository} for simple CRUD inside
 * the Kafka consumer path.
 */
@Primary
@Repository
public class ElasticsearchSearchAdapter implements SearchRepository {

    private static final Logger LOGGER = LoggerFactory.getLogger(ElasticsearchSearchAdapter.class);

    /** Sort field names used in Pageable come from SearchController (JPA names); map to ES field names. */
    private static final Map<String, String> SORT_FIELD_MAP = Map.of(
            "minPrice", "price",
            "maxPrice", "price",
            "createdAt", "createdAt",
            "averageRating", "averageRating",
            "totalSold", "totalSold"
    );

    private static final int FACET_MAX_BUCKETS = 100;
    private static final String STATUS_ACTIVE = "ACTIVE";

    private final ElasticsearchOperations elasticsearchOperations;
    private final SearchRepository fallbackRepository;

    public ElasticsearchSearchAdapter(
            ElasticsearchOperations elasticsearchOperations,
            @Qualifier("jpaSearchAdapter") SearchRepository fallbackRepository) {
        this.elasticsearchOperations = elasticsearchOperations;
        this.fallbackRepository = fallbackRepository;
    }

    // -------------------------------------------------------------------------
    // SearchRepository implementation
    // -------------------------------------------------------------------------

    @Override
    public Page<ProductReadModel> searchPaged(
            String query, String categoryId, String brand,
            BigDecimal minPrice, BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly,
            Pageable pageable) {
        try {
            NativeQuery nativeQuery = NativeQuery.builder()
                    .withQuery(buildSearchQuery(query, categoryId, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly))
                    .withPageable(pageable)
                    .withSort(toEsSort(pageable.getSort()))
                    .build();

            SearchHits<ProductDocument> hits = elasticsearchOperations.search(nativeQuery, ProductDocument.class);
            List<ProductReadModel> results = hits.getSearchHits().stream()
                    .map(SearchHit::getContent)
                    .map(ElasticsearchSearchAdapter::toReadModel)
                    .toList();
            if (hits.getTotalHits() == 0) {
                return fallbackRepository.searchPaged(
                        query, categoryId, brand, minPrice, maxPrice,
                        sameDay, verifiedOnly, officialOnly, pageable);
            }
            return new PageImpl<>(results, pageable, hits.getTotalHits());
        } catch (Exception ex) {
            LOGGER.warn("Elasticsearch searchPaged failed, using JPA read-model fallback. Cause: {}", ex.getMessage());
            return fallbackRepository.searchPaged(
                    query, categoryId, brand, minPrice, maxPrice,
                    sameDay, verifiedOnly, officialOnly, pageable);
        }
    }

    @Override
    public List<ProductReadModel> searchAfter(
            String query, String categoryId, String brand,
            BigDecimal minPrice, BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly,
            CursorSort sort, SearchCursor cursor, int limit) {
        try {
            NativeQueryBuilder builder = NativeQuery.builder()
                    .withQuery(buildSearchQuery(query, categoryId, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly))
                    .withPageable(Pageable.ofSize(limit))
                    .withSort(toCursorSort(sort))
                    .withTrackTotalHits(false);
            if (sort != CursorSort.NEWEST) {
                builder.withFilter(Query.of(filter -> filter.exists(exists -> exists.field("price"))));
            }
            if (cursor != null) {
                builder.withSearchAfter(searchAfterValues(cursor));
            }
            SearchHits<ProductDocument> hits = elasticsearchOperations.search(builder.build(), ProductDocument.class);
            List<ProductReadModel> results = hits.getSearchHits().stream()
                    .map(SearchHit::getContent)
                    .map(ElasticsearchSearchAdapter::toReadModel)
                    .toList();
            return results.isEmpty()
                    ? fallbackRepository.searchAfter(query, categoryId, brand, minPrice, maxPrice,
                    sameDay, verifiedOnly, officialOnly, sort, cursor, limit)
                    : results;
        } catch (Exception ex) {
            LOGGER.warn("Elasticsearch cursor search failed, using JPA read-model fallback. Cause: {}", ex.getMessage());
            return fallbackRepository.searchAfter(query, categoryId, brand, minPrice, maxPrice,
                    sameDay, verifiedOnly, officialOnly, sort, cursor, limit);
        }
    }

    @Override
    public List<String> findDistinctCategories() {
        try {
            Aggregation termsAgg = Aggregation.of(a -> a
                    .terms(t -> t.field("categoryId").size(FACET_MAX_BUCKETS)));
            NativeQuery nativeQuery = NativeQuery.builder()
                    .withQuery(Query.of(q -> q.matchAll(m -> m)))
                    .withAggregation("categories", termsAgg)
                    .withPageable(Pageable.ofSize(1))
                    .build();

            SearchHits<ProductDocument> hits = elasticsearchOperations.search(nativeQuery, ProductDocument.class);
            List<String> categories = extractStringTermsBuckets(hits, "categories").stream()
                    .map(b -> b.key().stringValue())
                    .sorted()
                    .toList();
            return categories.isEmpty() ? fallbackRepository.findDistinctCategories() : categories;
        } catch (Exception ex) {
            LOGGER.warn("Elasticsearch findDistinctCategories failed, using JPA read-model fallback. Cause: {}", ex.getMessage());
            return fallbackRepository.findDistinctCategories();
        }
    }

    @Override
    public List<String> suggestions(String prefix, Pageable pageable) {
        if (prefix == null || prefix.isBlank()) {
            return List.of();
        }
        try {
            Query prefixQuery = Query.of(q -> q
                    .bool(b -> b
                            .must(m -> m.prefix(p -> p.field("name").value(prefix.toLowerCase())))
                            .filter(f -> f.term(t -> t.field("status").value(STATUS_ACTIVE)))
                    )
            );
            NativeQuery nativeQuery = NativeQuery.builder()
                    .withQuery(prefixQuery)
                    .withPageable(pageable)
                    .build();

            SearchHits<ProductDocument> hits = elasticsearchOperations.search(nativeQuery, ProductDocument.class);
            List<String> suggestions = hits.getSearchHits().stream()
                    .map(hit -> hit.getContent().getName())
                    .filter(name -> name != null)
                    .distinct()
                    .toList();
            return suggestions.isEmpty() ? fallbackRepository.suggestions(prefix, pageable) : suggestions;
        } catch (Exception ex) {
            LOGGER.warn("Elasticsearch suggestions failed, using JPA read-model fallback. Cause: {}", ex.getMessage());
            return fallbackRepository.suggestions(prefix, pageable);
        }
    }

    @Override
    public List<SearchFacetsResponse.FacetEntry> categoryFacetsFor(
            String query, String brand, BigDecimal minPrice, BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        // Relax categoryId filter, apply brand/price filters
        List<SearchFacetsResponse.FacetEntry> facets = runTermsFacet(
                "categoryId", buildSearchQuery(query, null, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly));
        return facets.isEmpty()
                ? fallbackRepository.categoryFacetsFor(query, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly)
                : facets;
    }

    @Override
    public List<SearchFacetsResponse.FacetEntry> brandFacetsFor(
            String query, String categoryId, BigDecimal minPrice, BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        // Relax brand filter, apply categoryId/price filters
        List<SearchFacetsResponse.FacetEntry> facets = runTermsFacet(
                "brand", buildSearchQuery(query, categoryId, null, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly));
        return facets.isEmpty()
                ? fallbackRepository.brandFacetsFor(query, categoryId, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly)
                : facets;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Builds a BoolQuery that combines full-text search (if {@code query} is
     * non-blank) with keyword filters. Status=ACTIVE is always applied as a filter.
     */
    private static Query buildSearchQuery(
            String query, String categoryId, String brand,
            BigDecimal minPrice, BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {

        BoolQuery.Builder bool = new BoolQuery.Builder();

        // Full-text across analysed fields when a search term is supplied
        if (query != null && !query.isBlank()) {
            bool.must(Query.of(m -> m.multiMatch(mm -> mm
                    .query(query)
                    .fields("name^3", "description", "brand^2", "categoryName^2")
                    .fuzziness("AUTO")
            )));
        }

        // Always filter to active products
        bool.filter(Query.of(f -> f.term(t -> t.field("status").value(STATUS_ACTIVE))));

        // Optional keyword filters
        if (categoryId != null && !categoryId.isBlank()) {
            bool.filter(Query.of(f -> f.term(t -> t.field("categoryId").value(categoryId))));
        }
        if (brand != null && !brand.isBlank()) {
            bool.filter(Query.of(f -> f.term(t -> t.field("brand").value(brand))));
        }

        // Price range filter
        if (minPrice != null || maxPrice != null) {
            double min = minPrice != null ? minPrice.doubleValue() : Double.NEGATIVE_INFINITY;
            double max = maxPrice != null ? maxPrice.doubleValue() : Double.POSITIVE_INFINITY;
            bool.filter(Query.of(f -> f.range(r -> r.number(n -> {
                n.field("price");
                if (minPrice != null) n.gte(min);
                if (maxPrice != null) n.lte(max);
                return n;
            }))));
        }

        // Same-day delivery filter
        if (Boolean.TRUE.equals(sameDay)) {
            bool.filter(Query.of(f -> f.term(t -> t.field("sameDayDelivery").value(true))));
        }

        // Verified seller filter
        if (Boolean.TRUE.equals(verifiedOnly)) {
            bool.filter(Query.of(f -> f.term(t -> t.field("verified").value(true))));
        }

        // Official store filter
        if (Boolean.TRUE.equals(officialOnly)) {
            bool.filter(Query.of(f -> f.term(t -> t.field("isOfficial").value(true))));
        }

        BoolQuery builtBool = bool.build();
        return Query.of(q -> q.bool(builtBool));
    }

    /** Runs a terms aggregation on the given field over the provided filter query. */
    private List<SearchFacetsResponse.FacetEntry> runTermsFacet(String field, Query filterQuery) {
        try {
            Aggregation termsAgg = Aggregation.of(a -> a
                    .terms(t -> t.field(field).size(FACET_MAX_BUCKETS)));
            NativeQuery nativeQuery = NativeQuery.builder()
                    .withQuery(filterQuery)
                    .withAggregation(field, termsAgg)
                    .withPageable(Pageable.ofSize(1))
                    .build();

            SearchHits<ProductDocument> hits = elasticsearchOperations.search(nativeQuery, ProductDocument.class);
            return extractStringTermsBuckets(hits, field).stream()
                    .map(b -> new SearchFacetsResponse.FacetEntry(b.key().stringValue(), b.docCount()))
                    .toList();
        } catch (Exception ex) {
            LOGGER.warn("Elasticsearch facet query on field '{}' failed. Cause: {}", field, ex.getMessage());
            return List.of();
        }
    }

    /** Extracts the string terms buckets from an aggregation result by name. */
    private static List<StringTermsBucket> extractStringTermsBuckets(
            SearchHits<ProductDocument> hits, String aggName) {
        if (hits.getAggregations() == null) {
            return List.of();
        }
        ElasticsearchAggregations aggs = (ElasticsearchAggregations) hits.getAggregations();
        ElasticsearchAggregation agg = aggs.get(aggName);
        if (agg == null) {
            return List.of();
        }
        try {
            return agg.aggregation().getAggregate().sterms().buckets().array();
        } catch (Exception ex) {
            LOGGER.warn("Could not read string-terms buckets for aggregation '{}'. Cause: {}", aggName, ex.getMessage());
            return List.of();
        }
    }

    /**
     * Converts a Spring Data {@link Sort} to an Elasticsearch sort list.
     * JPA field names (e.g. {@code minPrice}) are translated to ES document
     * field names (e.g. {@code price}) via {@link #SORT_FIELD_MAP}.
     */
    private static List<co.elastic.clients.elasticsearch._types.SortOptions> toEsSort(Sort sort) {
        if (sort.isUnsorted()) {
            return List.of(defaultSort());
        }
        List<co.elastic.clients.elasticsearch._types.SortOptions> options = new ArrayList<>();
        for (Sort.Order order : sort) {
            String field = SORT_FIELD_MAP.getOrDefault(order.getProperty(), order.getProperty());
            SortOrder direction = order.isAscending() ? SortOrder.Asc : SortOrder.Desc;
            options.add(co.elastic.clients.elasticsearch._types.SortOptions.of(s -> s
                    .field(f -> f.field(field).order(direction))
            ));
        }
        return options;
    }

    private static List<co.elastic.clients.elasticsearch._types.SortOptions> toCursorSort(CursorSort sort) {
        String field = sort == CursorSort.NEWEST ? "createdAt" : "price";
        SortOrder direction = sort == CursorSort.PRICE_LOW ? SortOrder.Asc : SortOrder.Desc;
        return List.of(
                co.elastic.clients.elasticsearch._types.SortOptions.of(s -> s
                        .field(f -> f.field(field).order(direction))),
                co.elastic.clients.elasticsearch._types.SortOptions.of(s -> s
                        .field(f -> f.field("_id").order(direction)))
        );
    }

    private static List<Object> searchAfterValues(SearchCursor cursor) {
        Object primary = cursor.sort() == CursorSort.NEWEST
                ? cursor.createdAt().toString()
                : cursor.price();
        return List.of(primary, cursor.productId());
    }

    private static co.elastic.clients.elasticsearch._types.SortOptions defaultSort() {
        return co.elastic.clients.elasticsearch._types.SortOptions.of(s -> s
                .field(f -> f.field("createdAt").order(SortOrder.Desc))
        );
    }

    /** Maps a {@link ProductDocument} to the domain {@link ProductReadModel}. */
    private static ProductReadModel toReadModel(ProductDocument doc) {
        return new ProductReadModel(
                doc.getId(),
                doc.getName(),
                doc.getDescription(),
                doc.getCategoryId(),
                doc.getBrand(),
                doc.getStatus(),
                doc.getPrice(),    // ES stores a single price; map to both min and max
                doc.getPrice(),
                0,                 // variantCount not stored in ES document
                doc.getImageUrls() == null || doc.getImageUrls().isEmpty()
                        ? null
                        : doc.getImageUrls().getFirst(),
                doc.getStock() == null ? 0 : doc.getStock(),
                doc.getCreatedAt(),
                Boolean.TRUE.equals(doc.getSameDayDelivery()),
                Boolean.TRUE.equals(doc.getVerified()),
                Boolean.TRUE.equals(doc.getIsOfficial())
        );
    }
}
