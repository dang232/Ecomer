package com.vnshop.productservice.infrastructure.web.review;

import com.vnshop.productservice.domain.review.ProductReviewSummary;

import java.util.List;
import java.util.Map;

public record ProductSummariesResponse(List<ProductReviewSummaryResponse> summaries) {
    public static ProductSummariesResponse fromDomain(Map<String, ProductReviewSummary> summaries) {
        return new ProductSummariesResponse(summaries.values().stream()
                .map(ProductReviewSummaryResponse::fromDomain)
                .toList());
    }
}
