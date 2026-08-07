package com.vnshop.productservice.application.review;

import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.ProductReviewSummary;
import com.vnshop.productservice.domain.review.port.out.BuyerProfileLookupPort;
import com.vnshop.productservice.domain.review.port.out.BuyerProfileLookupPort.BuyerPublicProfile;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;

import java.util.Map;
import java.util.Objects;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public class GetProductReviewsUseCase {
    private final ReviewRepositoryPort reviewRepositoryPort;
    private final BuyerProfileLookupPort buyerProfileLookupPort;

    public GetProductReviewsUseCase(ReviewRepositoryPort reviewRepositoryPort,
            BuyerProfileLookupPort buyerProfileLookupPort) {
        this.reviewRepositoryPort = Objects.requireNonNull(reviewRepositoryPort, "reviewRepositoryPort is required");
        this.buyerProfileLookupPort = Objects.requireNonNull(buyerProfileLookupPort, "buyerProfileLookupPort is required");
    }

    public ProductReviewPage get(String productId, Pageable pageable) {
        Page<Review> reviews = reviewRepositoryPort.findApprovedByProductId(productId, pageable);
        if (reviews.isEmpty()) {
            return new ProductReviewPage(
                    Page.empty(pageable),
                    reviewRepositoryPort.getProductReviewSummary(productId),
                    reviewRepositoryPort.getProductReviewDistribution(productId));
        }
        // Batch the buyer-id lookup so the cross-service round-trip is
        // O(1) per request rather than O(N) per review. The port is
        // expected to fail-soft: an empty map means the FE renders the
        // anonymous fallback rather than the buyerId UUID.
        java.util.List<String> buyerIds = reviews.getContent().stream()
                .map(Review::buyerId)
                .distinct()
                .toList();
        Map<String, BuyerPublicProfile> profiles = buyerProfileLookupPort.lookup(buyerIds);
        Page<EnrichedReview> enrichedReviews = reviews.map(review -> {
            BuyerPublicProfile p = profiles.get(review.buyerId());
            return new EnrichedReview(review,
                    p == null ? null : p.displayName(),
                    p == null ? null : p.avatarUrl());
        });
        ProductReviewSummary summary = reviewRepositoryPort.getProductReviewSummary(productId);
        return new ProductReviewPage(
                enrichedReviews,
                summary,
                reviewRepositoryPort.getProductReviewDistribution(productId));
    }
}
