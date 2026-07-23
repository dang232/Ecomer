package com.vnshop.productservice.application.review;

import com.vnshop.productservice.domain.review.Review;

/**
 * Application-level review type that pairs a domain {@link Review} with
 * the buyer's resolved display info (name + avatar). The enrichment
 * happens in {@link GetProductReviewsUseCase} after the repo fetch so
 * the domain {@link Review} stays free of presentation-only fields.
 *
 * <p>{@code userName} and {@code userAvatarUrl} are nullable — when the
 * cross-service lookup fails or returns nothing for the buyer, the FE
 * renders an anonymous label rather than the buyerId UUID.</p>
 */
public record EnrichedReview(Review review, String userName, String userAvatarUrl, String productName) {
    public EnrichedReview(Review review, String userName, String userAvatarUrl) {
        this(review, userName, userAvatarUrl, null);
    }
}
