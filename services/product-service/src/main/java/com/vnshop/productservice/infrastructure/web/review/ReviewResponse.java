package com.vnshop.productservice.infrastructure.web.review;

import com.vnshop.productservice.application.review.EnrichedReview;
import com.vnshop.productservice.domain.review.Review;

import java.time.Instant;
import java.util.List;

public record ReviewResponse(String reviewId, String productId, String buyerId, String userName, String userAvatarUrl,
        String orderId, int rating, String text, List<String> images, boolean verifiedPurchase, int helpfulVotes,
        String status, String rejectionReason, Instant createdAt, String productName) {

    static ReviewResponse fromDomain(Review review) {
        // Used by mutation endpoints (POST /reviews, PUT helpful) where the
        // controller already authenticated the buyer and we don't need a
        // cross-service lookup just to echo the row back. userName /
        // userAvatarUrl come back as null and the FE renders the anonymous
        // fallback for that one row until the next list fetch hydrates it.
        return new ReviewResponse(review.reviewId().toString(), review.productId(), review.buyerId(),
                null, null,
                review.orderId(), review.rating(), review.text(), review.images(), review.verifiedPurchase(),
                review.helpfulVotes(), review.status().name(), review.rejectionReason(), review.createdAt(), null);
    }

    static ReviewResponse fromEnriched(EnrichedReview enriched) {
        Review review = enriched.review();
        return new ReviewResponse(review.reviewId().toString(), review.productId(), review.buyerId(),
                enriched.userName(), enriched.userAvatarUrl(),
                review.orderId(), review.rating(), review.text(), review.images(), review.verifiedPurchase(),
                review.helpfulVotes(), review.status().name(), review.rejectionReason(), review.createdAt(), enriched.productName());
    }
}
