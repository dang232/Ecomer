package com.vnshop.productservice.infrastructure.persistence.review;

import com.vnshop.productservice.domain.review.ReviewStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewJpaSpringDataRepository extends JpaRepository<ReviewJpaEntity, UUID> {
    boolean existsByProductIdAndBuyerId(String productId, String buyerId);

    List<ReviewJpaEntity> findByProductId(String productId);

    List<ReviewJpaEntity> findByProductIdAndStatus(String productId, ReviewStatus status);

    List<ReviewJpaEntity> findByBuyerId(String buyerId);

    List<ReviewJpaEntity> findByStatus(ReviewStatus status);

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
