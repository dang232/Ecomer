package com.vnshop.productservice.infrastructure.web.review;

import com.vnshop.productservice.domain.review.ProductReviewSummary;

public record ProductReviewSummaryResponse(String productId, Double ratingAvg, long ratingCount) {
    public static ProductReviewSummaryResponse fromDomain(ProductReviewSummary summary) {
        return new ProductReviewSummaryResponse(summary.productId(), summary.ratingAvg(), summary.ratingCount());
    }
}
