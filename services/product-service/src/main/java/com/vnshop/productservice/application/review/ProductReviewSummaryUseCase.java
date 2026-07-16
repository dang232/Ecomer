package com.vnshop.productservice.application.review;

import com.vnshop.productservice.domain.review.ProductReviewSummary;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;

import java.util.Map;
import java.util.Objects;
import java.util.Set;

public class ProductReviewSummaryUseCase {
    private static final int MAX_PRODUCT_IDS = 100;

    private final ReviewRepositoryPort reviewRepositoryPort;

    public ProductReviewSummaryUseCase(ReviewRepositoryPort reviewRepositoryPort) {
        this.reviewRepositoryPort = Objects.requireNonNull(reviewRepositoryPort, "reviewRepositoryPort is required");
    }

    public Map<String, ProductReviewSummary> getSummaries(Set<String> productIds) {
        validateProductIds(productIds);
        return reviewRepositoryPort.getProductReviewSummaries(productIds);
    }

    private void validateProductIds(Set<String> productIds) {
        if (productIds == null) {
            throw new IllegalArgumentException("productIds must not be null");
        }
        if (productIds.isEmpty()) {
            throw new IllegalArgumentException("productIds must not be empty");
        }
        if (productIds.size() > MAX_PRODUCT_IDS) {
            throw new IllegalArgumentException("productIds must not exceed " + MAX_PRODUCT_IDS + " entries");
        }
        if (productIds.stream().anyMatch(id -> id == null || id.isBlank())) {
            throw new IllegalArgumentException("productIds must not contain blank entries");
        }
    }
}
