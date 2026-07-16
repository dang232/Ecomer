package com.vnshop.productservice.domain.review.port.out;

import com.vnshop.productservice.domain.review.ReviewModerationDecision;
import com.vnshop.productservice.domain.review.ReviewModerationRequest;

public interface ReviewModerationPort {
    ReviewModerationDecision assess(ReviewModerationRequest request);
}
