package com.vnshop.productservice.domain.review.port.out;

import com.vnshop.productservice.domain.review.ProductQuestion;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.ReviewStatus;
import com.vnshop.productservice.domain.review.SellerReviewSummary;
import com.vnshop.productservice.domain.review.ProductReviewSummary;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface ReviewRepositoryPort {
    Review save(Review review);

    boolean existsByProductIdAndBuyerId(String productId, String buyerId);

    List<Review> findByProductId(String productId);

    List<Review> findByBuyerId(String buyerId);

    List<Review> findByStatus(ReviewStatus status);

    Optional<Review> findReviewById(UUID reviewId);

    Review moderate(UUID reviewId, ReviewStatus status);

    ProductQuestion saveQuestion(ProductQuestion question);

    List<ProductQuestion> findQuestionsByProductId(String productId);

    Optional<ProductQuestion> findQuestionById(UUID questionId);

    SellerReviewSummary getSellerReviewSummary(String sellerId);

    Map<String, SellerReviewSummary> getSellerReviewSummaries(Set<String> sellerIds);

    Map<String, ProductReviewSummary> getProductReviewSummaries(Set<String> productIds);
}
