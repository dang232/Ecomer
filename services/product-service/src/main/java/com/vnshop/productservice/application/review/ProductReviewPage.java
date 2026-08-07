package com.vnshop.productservice.application.review;

import com.vnshop.productservice.domain.review.ProductReviewSummary;
import java.util.Map;
import org.springframework.data.domain.Page;

public record ProductReviewPage(
        Page<EnrichedReview> page,
        ProductReviewSummary summary,
        Map<Integer, Long> distribution) {
}
