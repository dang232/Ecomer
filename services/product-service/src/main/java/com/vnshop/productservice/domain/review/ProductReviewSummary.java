package com.vnshop.productservice.domain.review;

/**
 * Public aggregate for a product's approved reviews.
 * ratingAvg is null when ratingCount is zero.
 */
public record ProductReviewSummary(String productId, Double ratingAvg, long ratingCount) {
}
