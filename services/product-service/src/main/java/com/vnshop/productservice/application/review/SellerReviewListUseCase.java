package com.vnshop.productservice.application.review;

import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.port.out.BuyerProfileLookupPort;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.Objects;

public class SellerReviewListUseCase {
    private final ReviewRepositoryPort reviewRepositoryPort;
    private final BuyerProfileLookupPort buyerProfileLookupPort;
    private final ProductRepositoryPort productRepositoryPort;

    public SellerReviewListUseCase(
            ReviewRepositoryPort reviewRepositoryPort,
            BuyerProfileLookupPort buyerProfileLookupPort,
            ProductRepositoryPort productRepositoryPort) {
        this.reviewRepositoryPort = Objects.requireNonNull(reviewRepositoryPort, "reviewRepositoryPort is required");
        this.buyerProfileLookupPort = Objects.requireNonNull(buyerProfileLookupPort, "buyerProfileLookupPort is required");
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
    }

    public Page<EnrichedReview> list(String sellerId, String query, Pageable pageable) {
        Page<Review> reviews = reviewRepositoryPort.findApprovedBySellerId(sellerId, query, pageable);
        if (reviews.isEmpty()) {
            return Page.empty(pageable);
        }
        List<String> buyerIds = reviews.getContent().stream()
                .map(Review::buyerId)
                .distinct()
                .toList();
        Map<String, BuyerProfileLookupPort.BuyerPublicProfile> profiles = buyerProfileLookupPort.lookup(buyerIds);
        Map<String, String> productNames = productRepositoryPort.findNamesByIds(
                reviews.getContent().stream().map(Review::productId).collect(java.util.stream.Collectors.toSet()));
        return reviews.map(review -> {
            BuyerProfileLookupPort.BuyerPublicProfile profile = profiles.get(review.buyerId());
            return new EnrichedReview(review,
                    profile == null ? null : profile.displayName(),
                    profile == null ? null : profile.avatarUrl(),
                    productNames.get(review.productId()));
        });
    }
}
