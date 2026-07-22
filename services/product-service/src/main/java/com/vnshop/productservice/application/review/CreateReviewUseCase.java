package com.vnshop.productservice.application.review;

import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.ReviewModerationDecision;
import com.vnshop.productservice.domain.review.ReviewModerationRequest;
import com.vnshop.productservice.domain.review.ReviewStatus;
import com.vnshop.productservice.domain.port.out.ContentSanitizerPort;
import com.vnshop.productservice.domain.review.port.out.PurchaseVerificationPort;
import com.vnshop.productservice.domain.review.port.out.ReviewModerationPort;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;

import java.util.Objects;

public class CreateReviewUseCase {
    private final ReviewRepositoryPort reviewRepositoryPort;
    private final ContentSanitizerPort contentSanitizer;
    private final PurchaseVerificationPort purchaseVerification;
    private final ReviewModerationPort reviewModeration;
    private final ProductRatingProjectionService productRatingProjectionService;

    public CreateReviewUseCase(
            ReviewRepositoryPort reviewRepositoryPort,
            ContentSanitizerPort contentSanitizer,
            PurchaseVerificationPort purchaseVerification,
            ReviewModerationPort reviewModeration) {
        this(reviewRepositoryPort, contentSanitizer, purchaseVerification, reviewModeration, null);
    }

    public CreateReviewUseCase(
            ReviewRepositoryPort reviewRepositoryPort,
            ContentSanitizerPort contentSanitizer,
            PurchaseVerificationPort purchaseVerification,
            ReviewModerationPort reviewModeration,
            ProductRatingProjectionService productRatingProjectionService) {
        this.reviewRepositoryPort = Objects.requireNonNull(reviewRepositoryPort, "reviewRepositoryPort is required");
        this.contentSanitizer = Objects.requireNonNull(contentSanitizer, "contentSanitizer is required");
        this.purchaseVerification = Objects.requireNonNull(purchaseVerification, "purchaseVerification is required");
        this.reviewModeration = Objects.requireNonNull(reviewModeration, "reviewModeration is required");
        this.productRatingProjectionService = productRatingProjectionService;
    }

    public Review create(CreateReviewCommand command) {
        if (reviewRepositoryPort.existsByProductIdAndBuyerId(command.productId(), command.buyerId())) {
            throw new IllegalStateException("You have already reviewed this product");
        }

        boolean verifiedPurchase = purchaseVerification.hasDeliveredPurchase(
                command.buyerId(), command.productId(), command.orderId());
        String sanitizedText = contentSanitizer.sanitize(command.text());
        ReviewModerationDecision decision = Objects.requireNonNull(reviewModeration.assess(
                new ReviewModerationRequest(sanitizedText, command.rating(), verifiedPurchase, command.images())),
                "review moderation decision is required");
        ReviewStatus initialStatus = switch (decision) {
            case APPROVE -> ReviewStatus.APPROVED;
            case REVIEW -> ReviewStatus.PENDING;
            case REJECT -> ReviewStatus.REJECTED;
        };
        Review review = Review.pending(
                command.productId(),
                command.buyerId(),
                command.orderId(),
                command.rating(),
                sanitizedText,
                command.images(),
                verifiedPurchase
        );
        Review saved = reviewRepositoryPort.save(
                initialStatus == ReviewStatus.PENDING ? review : review.withStatus(initialStatus));
        if (saved.status() == ReviewStatus.APPROVED && productRatingProjectionService != null) {
            productRatingProjectionService.publish(saved.productId());
        }
        return saved;
    }

}
