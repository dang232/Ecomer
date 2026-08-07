package com.vnshop.productservice.infrastructure.web.review;

import com.vnshop.productservice.application.review.ProductReviewPage;
import com.vnshop.productservice.domain.review.ProductReviewSummary;
import java.util.List;
import java.util.Map;

public record ProductReviewPageResponse(
        List<ReviewResponse> content,
        int number,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last,
        ReviewSummaryResponse summary) {

    static ProductReviewPageResponse from(ProductReviewPage page) {
        var source = page.page();
        return new ProductReviewPageResponse(
                source.getContent().stream().map(ReviewResponse::fromEnriched).toList(),
                source.getNumber(),
                source.getSize(),
                source.getTotalElements(),
                source.getTotalPages(),
                source.isFirst(),
                source.isLast(),
                ReviewSummaryResponse.from(page.summary(), page.distribution()));
    }

    public record ReviewSummaryResponse(
            Double average,
            long count,
            Map<Integer, Long> distribution) {

        private static ReviewSummaryResponse from(
                ProductReviewSummary summary,
                Map<Integer, Long> distribution) {
            return new ReviewSummaryResponse(summary.averageRating(), summary.reviewCount(), distribution);
        }
    }
}
