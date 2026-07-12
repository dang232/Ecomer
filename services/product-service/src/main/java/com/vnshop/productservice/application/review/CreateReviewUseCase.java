package com.vnshop.productservice.application.review;

import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.port.out.ContentSanitizerPort;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;

import java.util.Objects;

public class CreateReviewUseCase {
    private final ReviewRepositoryPort reviewRepositoryPort;
    private final ContentSanitizerPort contentSanitizer;

    public CreateReviewUseCase(ReviewRepositoryPort reviewRepositoryPort, ContentSanitizerPort contentSanitizer) {
        this.reviewRepositoryPort = Objects.requireNonNull(reviewRepositoryPort, "reviewRepositoryPort is required");
        this.contentSanitizer = Objects.requireNonNull(contentSanitizer, "contentSanitizer is required");
    }

    public Review create(CreateReviewCommand command) {
        if (reviewRepositoryPort.existsByProductIdAndBuyerId(command.productId(), command.buyerId())) {
            throw new IllegalStateException("You have already reviewed this product");
        }

        // TODO: Call order-service to verify buyer purchased this product
        // For now, mark as unverified until cross-service check is implemented
        boolean verifiedPurchase = false;
        return reviewRepositoryPort.save(Review.pending(
                command.productId(),
                command.buyerId(),
                command.orderId(),
                command.rating(),
                contentSanitizer.sanitize(command.text()),
                command.images(),
                verifiedPurchase
        ));
    }

    private boolean buyerIdMatchesOrderHistory(String buyerId, String orderId) {
        return false;
    }
}
