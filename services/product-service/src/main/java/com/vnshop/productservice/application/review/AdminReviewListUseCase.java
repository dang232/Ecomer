package com.vnshop.productservice.application.review;

import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.port.out.BuyerProfileLookupPort;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Builds the admin moderation read model inside product-service. */
public class AdminReviewListUseCase {
    private final ReviewRepositoryPort reviewRepositoryPort;
    private final BuyerProfileLookupPort buyerProfileLookupPort;
    private final ProductRepositoryPort productRepositoryPort;

    public AdminReviewListUseCase(
            ReviewRepositoryPort reviewRepositoryPort,
            BuyerProfileLookupPort buyerProfileLookupPort,
            ProductRepositoryPort productRepositoryPort) {
        this.reviewRepositoryPort = Objects.requireNonNull(reviewRepositoryPort, "reviewRepositoryPort is required");
        this.buyerProfileLookupPort = Objects.requireNonNull(buyerProfileLookupPort, "buyerProfileLookupPort is required");
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
    }

    public List<EnrichedReview> pending(String query) {
        List<Review> reviews = reviewRepositoryPort.findByStatus(
                com.vnshop.productservice.domain.review.ReviewStatus.PENDING, query);
        if (reviews.isEmpty()) {
            return List.of();
        }
        Map<String, BuyerProfileLookupPort.BuyerPublicProfile> buyers = buyerProfileLookupPort.lookup(
                reviews.stream().map(Review::buyerId).distinct().toList());
        Map<String, String> products = productRepositoryPort.findNamesByIds(
                reviews.stream().map(Review::productId).collect(java.util.stream.Collectors.toSet()));
        return reviews.stream().map(review -> {
            BuyerProfileLookupPort.BuyerPublicProfile buyer = buyers.get(review.buyerId());
            return new EnrichedReview(
                    review,
                    buyer == null ? null : buyer.displayName(),
                    buyer == null ? null : buyer.avatarUrl(),
                    products.get(review.productId()));
        }).toList();
    }
}
