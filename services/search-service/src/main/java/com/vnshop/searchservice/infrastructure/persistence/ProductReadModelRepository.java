package com.vnshop.searchservice.infrastructure.persistence;

import com.vnshop.searchservice.domain.ProductReadModel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Repository
public interface ProductReadModelRepository extends JpaRepository<ProductReadModelJpaEntity, String> {
    @Query("""
            select product from ProductReadModelJpaEntity product
            where product.status = 'ACTIVE'
              and (:query is null or lower(product.name) like lower(concat('%', cast(:query as string), '%')) or lower(product.description) like lower(concat('%', cast(:query as string), '%')))
              and (:categoryId is null or product.categoryId = cast(:categoryId as string))
              and (:brand is null or product.brand = cast(:brand as string))
              and (:minPrice is null or product.maxPrice >= :minPrice)
              and (:maxPrice is null or product.minPrice <= :maxPrice)
              and (:sameDay is null or product.sameDayDelivery = :sameDay)
              and (:verifiedOnly is null or product.verified = :verifiedOnly)
              and (:officialOnly is null or product.isOfficial = :officialOnly)
              and (:anchorCreatedAt is null or product.createdAt < :anchorCreatedAt
                   or (product.createdAt = :anchorCreatedAt and product.productId < cast(:anchorProductId as string)))
            order by product.createdAt desc, product.productId desc
            """)
    List<ProductReadModelJpaEntity> searchAfterNewest(
            @Param("query") String query,
            @Param("categoryId") String categoryId,
            @Param("brand") String brand,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("sameDay") Boolean sameDay,
            @Param("verifiedOnly") Boolean verifiedOnly,
            @Param("officialOnly") Boolean officialOnly,
            @Param("anchorCreatedAt") Instant anchorCreatedAt,
            @Param("anchorProductId") String anchorProductId,
            Pageable pageable
    );

    @Query("""
            select product from ProductReadModelJpaEntity product
            where product.status = 'ACTIVE'
              and product.minPrice is not null
              and (:query is null or lower(product.name) like lower(concat('%', cast(:query as string), '%')) or lower(product.description) like lower(concat('%', cast(:query as string), '%')))
              and (:categoryId is null or product.categoryId = cast(:categoryId as string))
              and (:brand is null or product.brand = cast(:brand as string))
              and (:minPrice is null or product.maxPrice >= :minPrice)
              and (:maxPrice is null or product.minPrice <= :maxPrice)
              and (:sameDay is null or product.sameDayDelivery = :sameDay)
              and (:verifiedOnly is null or product.verified = :verifiedOnly)
              and (:officialOnly is null or product.isOfficial = :officialOnly)
              and (:anchorPrice is null or product.minPrice > :anchorPrice
                   or (product.minPrice = :anchorPrice and product.productId > cast(:anchorProductId as string)))
            order by product.minPrice asc, product.productId asc
            """)
    List<ProductReadModelJpaEntity> searchAfterPriceLow(
            @Param("query") String query,
            @Param("categoryId") String categoryId,
            @Param("brand") String brand,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("sameDay") Boolean sameDay,
            @Param("verifiedOnly") Boolean verifiedOnly,
            @Param("officialOnly") Boolean officialOnly,
            @Param("anchorPrice") BigDecimal anchorPrice,
            @Param("anchorProductId") String anchorProductId,
            Pageable pageable
    );

    @Query("""
            select product from ProductReadModelJpaEntity product
            where product.status = 'ACTIVE'
              and product.minPrice is not null
              and (:query is null or lower(product.name) like lower(concat('%', cast(:query as string), '%')) or lower(product.description) like lower(concat('%', cast(:query as string), '%')))
              and (:categoryId is null or product.categoryId = cast(:categoryId as string))
              and (:brand is null or product.brand = cast(:brand as string))
              and (:minPrice is null or product.maxPrice >= :minPrice)
              and (:maxPrice is null or product.minPrice <= :maxPrice)
              and (:sameDay is null or product.sameDayDelivery = :sameDay)
              and (:verifiedOnly is null or product.verified = :verifiedOnly)
              and (:officialOnly is null or product.isOfficial = :officialOnly)
              and (:anchorPrice is null or product.minPrice < :anchorPrice
                   or (product.minPrice = :anchorPrice and product.productId < cast(:anchorProductId as string)))
            order by product.minPrice desc, product.productId desc
            """)
    List<ProductReadModelJpaEntity> searchAfterPriceHigh(
            @Param("query") String query,
            @Param("categoryId") String categoryId,
            @Param("brand") String brand,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("sameDay") Boolean sameDay,
            @Param("verifiedOnly") Boolean verifiedOnly,
            @Param("officialOnly") Boolean officialOnly,
            @Param("anchorPrice") BigDecimal anchorPrice,
            @Param("anchorProductId") String anchorProductId,
            Pageable pageable
    );

    @Query("""
            select product from ProductReadModelJpaEntity product
            where product.status = 'ACTIVE'
              and (:query is null or lower(product.name) like lower(concat('%', cast(:query as string), '%')) or lower(product.description) like lower(concat('%', cast(:query as string), '%')))
              and (:categoryId is null or product.categoryId = cast(:categoryId as string))
              and (:brand is null or product.brand = cast(:brand as string))
              and (:minPrice is null or product.maxPrice >= :minPrice)
              and (:maxPrice is null or product.minPrice <= :maxPrice)
              and (:sameDay is null or product.sameDayDelivery = :sameDay)
              and (:verifiedOnly is null or product.verified = :verifiedOnly)
              and (:officialOnly is null or product.isOfficial = :officialOnly)
            """)
    Page<ProductReadModelJpaEntity> searchEntitiesPaged(
            @Param("query") String query,
            @Param("categoryId") String categoryId,
            @Param("brand") String brand,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("sameDay") Boolean sameDay,
            @Param("verifiedOnly") Boolean verifiedOnly,
            @Param("officialOnly") Boolean officialOnly,
            Pageable pageable
    );

    @Query("select distinct product.categoryId from ProductReadModelJpaEntity product where product.status = 'ACTIVE' and product.categoryId is not null")
    List<String> findDistinctCategories();

    /** Prefix-match on name for header autocomplete. Uses idx_product_read_models_name_lower. */
    @Query("""
            select product.name from ProductReadModelJpaEntity product
            where product.status = 'ACTIVE'
              and lower(product.name) like lower(concat(cast(:prefix as string), '%'))
            order by product.name asc
            """)
    List<String> findSuggestions(@Param("prefix") String prefix, Pageable pageable);

    /**
     * Facet aggregation queries scoped by the same WHERE clause as the main
     * search. Returns Object[] of (key, count) so the use case can build the
     * response shape without exposing JPA internals.
     *
     * <p>Note: the {@code cast(:param as string)} pattern is required because
     * Hibernate binds null nullable-string parameters as {@code bytea} on
     * PostgreSQL, and {@code lower(bytea)} doesn't exist. Same root cause as
     * the V10 fix on product-service findCatalog.
     */
    @Query("""
            select product.categoryId, count(product) from ProductReadModelJpaEntity product
            where product.status = 'ACTIVE'
              and (:query is null or lower(product.name) like lower(concat('%', cast(:query as string), '%')) or lower(product.description) like lower(concat('%', cast(:query as string), '%')))
              and (:brand is null or product.brand = cast(:brand as string))
              and (:minPrice is null or product.maxPrice >= :minPrice)
              and (:maxPrice is null or product.minPrice <= :maxPrice)
              and (:sameDay is null or product.sameDayDelivery = :sameDay)
              and (:verifiedOnly is null or product.verified = :verifiedOnly)
              and (:officialOnly is null or product.isOfficial = :officialOnly)
              and product.categoryId is not null
            group by product.categoryId
            order by count(product) desc, product.categoryId asc
            """)
    List<Object[]> categoryFacets(
            @Param("query") String query,
            @Param("brand") String brand,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("sameDay") Boolean sameDay,
            @Param("verifiedOnly") Boolean verifiedOnly,
            @Param("officialOnly") Boolean officialOnly
    );

    @Query("""
            select product.brand, count(product) from ProductReadModelJpaEntity product
            where product.status = 'ACTIVE'
              and (:query is null or lower(product.name) like lower(concat('%', cast(:query as string), '%')) or lower(product.description) like lower(concat('%', cast(:query as string), '%')))
              and (:categoryId is null or product.categoryId = cast(:categoryId as string))
              and (:minPrice is null or product.maxPrice >= :minPrice)
              and (:maxPrice is null or product.minPrice <= :maxPrice)
              and (:sameDay is null or product.sameDayDelivery = :sameDay)
              and (:verifiedOnly is null or product.verified = :verifiedOnly)
              and (:officialOnly is null or product.isOfficial = :officialOnly)
              and product.brand is not null
            group by product.brand
            order by count(product) desc, product.brand asc
            """)
    List<Object[]> brandFacets(
            @Param("query") String query,
            @Param("categoryId") String categoryId,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("sameDay") Boolean sameDay,
            @Param("verifiedOnly") Boolean verifiedOnly,
            @Param("officialOnly") Boolean officialOnly
    );

    default Page<ProductReadModel> searchPaged(String query, String categoryId, String brand, BigDecimal minPrice, BigDecimal maxPrice, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly, Pageable pageable) {
        return searchEntitiesPaged(blankToNull(query), blankToNull(categoryId), blankToNull(brand), minPrice, maxPrice, sameDay, verifiedOnly, officialOnly, pageable)
                .map(ProductReadModelJpaEntity::toDomain);
    }

    default List<String> suggestions(String prefix, Pageable pageable) {
        String normalized = blankToNull(prefix);
        if (normalized == null) {
            return List.of();
        }
        return findSuggestions(normalized, pageable);
    }

    default List<Object[]> categoryFacetsFor(String query, String brand, BigDecimal minPrice, BigDecimal maxPrice, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        return categoryFacets(blankToNull(query), blankToNull(brand), minPrice, maxPrice, sameDay, verifiedOnly, officialOnly);
    }

    default List<Object[]> brandFacetsFor(String query, String categoryId, BigDecimal minPrice, BigDecimal maxPrice, Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly) {
        return brandFacets(blankToNull(query), blankToNull(categoryId), minPrice, maxPrice, sameDay, verifiedOnly, officialOnly);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
