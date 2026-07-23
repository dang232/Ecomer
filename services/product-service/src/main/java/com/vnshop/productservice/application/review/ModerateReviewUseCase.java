package com.vnshop.productservice.application.review;

import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.ReviewStatus;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

public class ModerateReviewUseCase {
    private final ReviewRepositoryPort reviewRepositoryPort;
    private final ProductRatingProjectionService productRatingProjectionService;

    public ModerateReviewUseCase(ReviewRepositoryPort reviewRepositoryPort) {
        this(reviewRepositoryPort, null);
    }

    public ModerateReviewUseCase(ReviewRepositoryPort reviewRepositoryPort,
            ProductRatingProjectionService productRatingProjectionService) {
        this.reviewRepositoryPort = Objects.requireNonNull(reviewRepositoryPort, "reviewRepositoryPort is required");
        this.productRatingProjectionService = productRatingProjectionService;
    }

    public List<Review> pending() {
        return reviewRepositoryPort.findByStatus(ReviewStatus.PENDING);
    }

    public List<Review> pending(String query) {
        return reviewRepositoryPort.findByStatus(ReviewStatus.PENDING, query);
    }

    public Review approve(UUID reviewId) {
        Review approved = reviewRepositoryPort.moderate(reviewId, ReviewStatus.APPROVED);
        if (productRatingProjectionService != null) {
            productRatingProjectionService.publish(approved.productId());
        }
        return approved;
    }

    public Review reject(UUID reviewId) {
        return reject(reviewId, null);
    }

    public Review reject(UUID reviewId, String reason) {
        return reviewRepositoryPort.moderate(reviewId, ReviewStatus.REJECTED, reason);
    }
}
