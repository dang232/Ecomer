package com.vnshop.productservice.domain.review;

/** Published review aggregate used by product read-model projections. */
public record ProductReviewSummary(Double averageRating, long reviewCount) {
    public ProductReviewSummary {
        if (reviewCount < 0) {
            throw new IllegalArgumentException("reviewCount must be non-negative");
        }
        if (averageRating != null && (averageRating < 1d || averageRating > 5d)) {
            throw new IllegalArgumentException("averageRating must be between 1 and 5");
        }
    }

    public static ProductReviewSummary empty() {
        return new ProductReviewSummary(null, 0);
    }
}
