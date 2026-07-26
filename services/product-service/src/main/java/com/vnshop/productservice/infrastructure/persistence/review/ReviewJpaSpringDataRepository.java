package com.vnshop.productservice.infrastructure.persistence.review;

import com.vnshop.productservice.domain.review.ReviewStatus;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewJpaSpringDataRepository extends JpaRepository<ReviewJpaEntity, UUID> {
    boolean existsByProductIdAndBuyerId(String productId, String buyerId);

    List<ReviewJpaEntity> findByProductId(String productId);

    List<ReviewJpaEntity> findByProductIdAndStatus(String productId, ReviewStatus status);

    @Query(value = """
            SELECT AVG(r.rating), COUNT(r.review_id)
            FROM product_svc.reviews r
            WHERE r.product_id = :productId
              AND r.status = 'APPROVED'
            """, nativeQuery = true)
    List<Object[]> findProductReviewStats(@Param("productId") String productId);

    @Query(value = """
            SELECT r.product_id, AVG(r.rating), COUNT(r.review_id)
            FROM product_svc.reviews r
            WHERE r.product_id IN (:productIds)
              AND r.status = 'APPROVED'
            GROUP BY r.product_id
            """, nativeQuery = true)
    List<Object[]> findProductReviewStatsBatch(@Param("productIds") Collection<String> productIds);

    @Query(value = """
            SELECT DISTINCT r.product_id
            FROM product_svc.reviews r
            JOIN product_svc.products p ON CAST(p.id AS VARCHAR) = r.product_id
            WHERE r.status = 'APPROVED'
            ORDER BY r.product_id
            """, nativeQuery = true)
    List<String> findProductIdsWithApprovedReviews();

    List<ReviewJpaEntity> findByBuyerId(String buyerId);

    List<ReviewJpaEntity> findByStatus(ReviewStatus status);

    @Query(value = """
            SELECT r.*
            FROM product_svc.reviews r
            LEFT JOIN product_svc.products p ON CAST(p.id AS VARCHAR) = r.product_id
            WHERE r.status = :status
              AND (
                    :query = ''
                    OR lower(CAST(r.review_id AS text)) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(r.product_id) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(r.buyer_id) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(COALESCE(r.order_id, '')) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(COALESCE(r.text, '')) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(COALESCE(p.name, '')) LIKE CONCAT('%', lower(:query), '%')
                  )
            ORDER BY r.created_at DESC, r.review_id DESC
            """, nativeQuery = true)
    List<ReviewJpaEntity> findByStatusAndQuery(@Param("status") String status, @Param("query") String query);

    @Query(value = """
            SELECT r.*
            FROM product_svc.reviews r
            JOIN product_svc.products p ON CAST(p.id AS VARCHAR) = r.product_id
            WHERE p.seller_id = :sellerId
              AND r.status = 'APPROVED'
              AND (
                    :query = ''
                    OR lower(CAST(r.review_id AS text)) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(r.product_id) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(COALESCE(r.order_id, '')) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(COALESCE(r.text, '')) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(COALESCE(p.name, '')) LIKE CONCAT('%', lower(:query), '%')
                  )
            ORDER BY r.created_at DESC, r.review_id DESC
            """,
            countQuery = """
            SELECT COUNT(*)
            FROM product_svc.reviews r
            JOIN product_svc.products p ON CAST(p.id AS VARCHAR) = r.product_id
            WHERE p.seller_id = :sellerId
              AND r.status = 'APPROVED'
              AND (
                    :query = ''
                    OR lower(CAST(r.review_id AS text)) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(r.product_id) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(COALESCE(r.order_id, '')) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(COALESCE(r.text, '')) LIKE CONCAT('%', lower(:query), '%')
                    OR lower(COALESCE(p.name, '')) LIKE CONCAT('%', lower(:query), '%')
                  )
            """,
            nativeQuery = true)
    Page<ReviewJpaEntity> findApprovedBySellerId(
            @Param("sellerId") String sellerId,
            @Param("query") String query,
            Pageable pageable);

    /**
     * Returns [[AVG(rating), COUNT(review_id)]] across all reviews whose
     * product is owned by the given seller. The list always contains exactly
     * one row (group-less aggregate). AVG is null when there are no matching
     * reviews. Declared as List<Object[]> rather than Object[] because some
     * Spring Data + Hibernate combinations wrap the single aggregate row in
     * an outer one-element array, which makes Object[] indexing brittle.
     */
    @Query(value = """
            SELECT AVG(r.rating), COUNT(r.review_id)
            FROM product_svc.reviews r
            JOIN product_svc.products p ON r.product_id = CAST(p.id AS VARCHAR)
            WHERE p.seller_id = :sellerId
              AND r.status = 'APPROVED'
            """, nativeQuery = true)
    List<Object[]> findSellerReviewStats(@Param("sellerId") String sellerId);

    @Query(value = """
            SELECT p.seller_id, AVG(r.rating), COUNT(r.review_id)
            FROM product_svc.reviews r
            JOIN product_svc.products p ON r.product_id = CAST(p.id AS VARCHAR)
            WHERE p.seller_id IN (:sellerIds)
              AND r.status = 'APPROVED'
            GROUP BY p.seller_id
            """, nativeQuery = true)
    List<Object[]> findSellerReviewStatsBatch(@Param("sellerIds") java.util.Collection<String> sellerIds);
}
