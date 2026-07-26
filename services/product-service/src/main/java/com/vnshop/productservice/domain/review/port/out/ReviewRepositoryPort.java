package com.vnshop.productservice.domain.review.port.out;

import com.vnshop.productservice.domain.review.ProductQuestion;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.ProductReviewSummary;
import com.vnshop.productservice.domain.review.ReviewStatus;
import com.vnshop.productservice.domain.review.SellerReviewSummary;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ReviewRepositoryPort extends ProductRatingReadPort {
    Review save(Review review);

    boolean existsByProductIdAndBuyerId(String productId, String buyerId);

    List<Review> findByProductId(String productId);

    /** Returns products whose approved reviews need a rating projection. */
    default List<String> findProductIdsWithApprovedReviews() {
        return List.of();
    }

    List<Review> findByBuyerId(String buyerId);

    List<Review> findByStatus(ReviewStatus status);

    default List<Review> findByStatus(ReviewStatus status, String query) {
        return findByStatus(status);
    }

    default Page<Review> findApprovedBySellerId(String sellerId, String query, Pageable pageable) {
        throw new UnsupportedOperationException("seller review listing is not available for this repository");
    }

    Optional<Review> findReviewById(UUID reviewId);

    Review moderate(UUID reviewId, ReviewStatus status);

    default Review moderate(UUID reviewId, ReviewStatus status, String rejectionReason) {
        return moderate(reviewId, status).withRejectionReason(rejectionReason);
    }

    ProductQuestion saveQuestion(ProductQuestion question);

    List<ProductQuestion> findQuestionsByProductId(String productId);

    Optional<ProductQuestion> findQuestionById(UUID questionId);

    SellerReviewSummary getSellerReviewSummary(String sellerId);

    Map<String, SellerReviewSummary> getSellerReviewSummaries(Set<String> sellerIds);
}
