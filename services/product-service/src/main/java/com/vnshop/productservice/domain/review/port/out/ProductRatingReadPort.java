package com.vnshop.productservice.domain.review.port.out;

import com.vnshop.productservice.domain.review.ProductReviewSummary;

import java.util.Collection;
import java.util.Map;

/** Narrow read port for approved product rating aggregates used by catalog views. */
public interface ProductRatingReadPort {
    default ProductReviewSummary getProductReviewSummary(String productId) {
        return ProductReviewSummary.empty();
    }

    default Map<String, ProductReviewSummary> getProductReviewSummaries(Collection<String> productIds) {
        if (productIds == null || productIds.isEmpty()) {
            return Map.of();
        }
        return productIds.stream().collect(java.util.stream.Collectors.toUnmodifiableMap(
                id -> id,
                this::getProductReviewSummary
        ));
    }
}
