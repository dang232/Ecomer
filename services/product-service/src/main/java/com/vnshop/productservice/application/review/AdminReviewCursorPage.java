package com.vnshop.productservice.application.review;

import java.util.List;

public record AdminReviewCursorPage(List<EnrichedReview> items, boolean hasMore) {}
