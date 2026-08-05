package com.vnshop.productservice.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface ProductJpaSpringDataRepository extends JpaRepository<ProductJpaEntity, UUID> {
    @Query("""
            select product from ProductJpaEntity product join product.variants variant
            where product.status = 'ACTIVE'
              and (:categoryId is null or product.categoryId = cast(:categoryId as string))
              and (:q is null or lower(product.name) like lower(concat('%', cast(:q as string), '%')))
              and (:brand is null or product.brand = cast(:brand as string))
              and (:sameDay is null or product.sameDayDelivery = :sameDay)
              and (:verifiedOnly is null or product.verified = :verifiedOnly)
              and (:officialOnly is null or product.isOfficial = :officialOnly)
            group by product
            having (:minPrice is null or min(variant.price.amount) >= :minPrice)
               and (:maxPrice is null or min(variant.price.amount) <= :maxPrice)
               and (cast(:anchorCreatedAt as Instant) is null or product.createdAt < :anchorCreatedAt
                    or (product.createdAt = :anchorCreatedAt and product.id < :anchorProductId))
            order by product.createdAt desc, product.id desc
            """)
    List<ProductJpaEntity> findCatalogAfterNewest(
            @Param("categoryId") String categoryId, @Param("q") String q, @Param("brand") String brand,
            @Param("minPrice") BigDecimal minPrice, @Param("maxPrice") BigDecimal maxPrice,
            @Param("sameDay") Boolean sameDay, @Param("verifiedOnly") Boolean verifiedOnly,
            @Param("officialOnly") Boolean officialOnly, @Param("anchorCreatedAt") Instant anchorCreatedAt,
            @Param("anchorProductId") UUID anchorProductId, org.springframework.data.domain.Pageable pageable);

    @Query("""
            select product from ProductJpaEntity product join product.variants variant
            where product.status = 'ACTIVE'
              and (:categoryId is null or product.categoryId = cast(:categoryId as string))
              and (:q is null or lower(product.name) like lower(concat('%', cast(:q as string), '%')))
              and (:brand is null or product.brand = cast(:brand as string))
              and (:sameDay is null or product.sameDayDelivery = :sameDay)
              and (:verifiedOnly is null or product.verified = :verifiedOnly)
              and (:officialOnly is null or product.isOfficial = :officialOnly)
            group by product
            having (:minPrice is null or min(variant.price.amount) >= :minPrice)
               and (:maxPrice is null or min(variant.price.amount) <= :maxPrice)
               and (cast(:anchorPrice as BigDecimal) is null or min(variant.price.amount) > :anchorPrice
                    or (min(variant.price.amount) = :anchorPrice and product.id > :anchorProductId))
            order by min(variant.price.amount) asc, product.id asc
            """)
    List<ProductJpaEntity> findCatalogAfterPriceLow(
            @Param("categoryId") String categoryId, @Param("q") String q, @Param("brand") String brand,
            @Param("minPrice") BigDecimal minPrice, @Param("maxPrice") BigDecimal maxPrice,
            @Param("sameDay") Boolean sameDay, @Param("verifiedOnly") Boolean verifiedOnly,
            @Param("officialOnly") Boolean officialOnly, @Param("anchorPrice") BigDecimal anchorPrice,
            @Param("anchorProductId") UUID anchorProductId, org.springframework.data.domain.Pageable pageable);

    @Query("""
            select product from ProductJpaEntity product join product.variants variant
            where product.status = 'ACTIVE'
              and (:categoryId is null or product.categoryId = cast(:categoryId as string))
              and (:q is null or lower(product.name) like lower(concat('%', cast(:q as string), '%')))
              and (:brand is null or product.brand = cast(:brand as string))
              and (:sameDay is null or product.sameDayDelivery = :sameDay)
              and (:verifiedOnly is null or product.verified = :verifiedOnly)
              and (:officialOnly is null or product.isOfficial = :officialOnly)
            group by product
            having (:minPrice is null or min(variant.price.amount) >= :minPrice)
               and (:maxPrice is null or min(variant.price.amount) <= :maxPrice)
               and (cast(:anchorPrice as BigDecimal) is null or min(variant.price.amount) < :anchorPrice
                    or (min(variant.price.amount) = :anchorPrice and product.id < :anchorProductId))
            order by min(variant.price.amount) desc, product.id desc
            """)
    List<ProductJpaEntity> findCatalogAfterPriceHigh(
            @Param("categoryId") String categoryId, @Param("q") String q, @Param("brand") String brand,
            @Param("minPrice") BigDecimal minPrice, @Param("maxPrice") BigDecimal maxPrice,
            @Param("sameDay") Boolean sameDay, @Param("verifiedOnly") Boolean verifiedOnly,
            @Param("officialOnly") Boolean officialOnly, @Param("anchorPrice") BigDecimal anchorPrice,
            @Param("anchorProductId") UUID anchorProductId, org.springframework.data.domain.Pageable pageable);

    List<ProductJpaEntity> findBySellerId(String sellerId);

    /** Seller management query: owner-scoped, pageable, and never exposes soft-deleted rows. */
    @Query("""
            select product from ProductJpaEntity product
            where product.sellerId = :sellerId
              and product.status <> 'DELETED'
              and (:q is null or lower(product.name) like lower(concat('%', cast(:q as string), '%')))
              and (:categoryId is null or product.categoryId = :categoryId)
              and (:status is null or product.status = :status)
            order by product.createdAt desc, product.id desc
            """)
    Page<ProductJpaEntity> findSellerProducts(
            @Param("sellerId") String sellerId,
            @Param("q") String q,
            @Param("categoryId") String categoryId,
            @Param("status") String status,
            Pageable pageable);

    Optional<ProductJpaEntity> findByIdAndSellerIdAndStatusNot(UUID id, String sellerId, String status);

    List<ProductJpaEntity> findByCategoryId(String categoryId);

    @Query("select product from ProductJpaEntity product where lower(product.name) like lower(concat('%', :name, '%'))")
    List<ProductJpaEntity> searchByName(@Param("name") String name);

    @Query("select distinct product.categoryId from ProductJpaEntity product where product.status = 'ACTIVE' and product.categoryId is not null")
    List<String> findDistinctCategories();

    /**
     * Paged catalog query. Both filters are optional — pass null to skip.
     * The {@code :q} clause uses the same lower-LIKE pattern as searchByName so
     * the matching semantics stay consistent.
     * Only ACTIVE products are visible in the buyer catalog.
     */
    @Query("""
            select product from ProductJpaEntity product
            where (:categoryId is null or product.categoryId = cast(:categoryId as string))
              and (:q is null or lower(product.name) like lower(concat('%', cast(:q as string), '%')))
              and (:sellerId is null or product.sellerId = cast(:sellerId as string))
              and product.status = 'ACTIVE'
            """)
    Page<ProductJpaEntity> findCatalog(
            @Param("categoryId") String categoryId,
            @Param("q") String q,
            @Param("sellerId") String sellerId,
            Pageable pageable
    );

    long countBySellerId(String sellerId);

    @Query("SELECT p.sellerId, COUNT(p) FROM ProductJpaEntity p WHERE p.sellerId IN :ids GROUP BY p.sellerId")
    List<Object[]> countBySellerIds(@Param("ids") java.util.Collection<String> ids);
}
