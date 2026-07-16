package com.vnshop.productservice.application.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.domain.port.out.ContentSanitizerPort;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.ReviewModerationDecision;
import com.vnshop.productservice.domain.review.ReviewModerationRequest;
import com.vnshop.productservice.domain.review.ReviewStatus;
import com.vnshop.productservice.domain.review.port.out.PurchaseVerificationPort;
import com.vnshop.productservice.domain.review.port.out.ReviewModerationPort;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;

class CreateReviewUseCaseTest {
    private final ReviewRepositoryPort reviewRepository = mock(ReviewRepositoryPort.class);
    private final ContentSanitizerPort contentSanitizer = mock(ContentSanitizerPort.class);
    private final PurchaseVerificationPort purchaseVerification = mock(PurchaseVerificationPort.class);
    private final ReviewModerationPort reviewModeration = mock(ReviewModerationPort.class);
    private final CreateReviewUseCase useCase = new CreateReviewUseCase(
            reviewRepository,
            contentSanitizer,
            purchaseVerification,
            reviewModeration);

    @Test
    void marksReviewAsVerifiedWhenBuyerHasDeliveredPurchase() {
        when(purchaseVerification.hasDeliveredPurchase("buyer-1", "product-1", "order-1"))
                .thenReturn(true);
        when(contentSanitizer.sanitize("great product")).thenReturn("great product");
        when(reviewModeration.assess(any(ReviewModerationRequest.class)))
                .thenReturn(ReviewModerationDecision.REVIEW);
        when(reviewRepository.save(any(Review.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Review review = useCase.create(new CreateReviewCommand(
                "product-1", "buyer-1", "order-1", 5, "great product", java.util.List.of()));

        assertThat(review.verifiedPurchase()).isTrue();
        assertThat(review.status()).isEqualTo(ReviewStatus.PENDING);
        verify(purchaseVerification).hasDeliveredPurchase("buyer-1", "product-1", "order-1");
    }

    @Test
    void leavesReviewUnverifiedWhenBuyerHasNoDeliveredPurchase() {
        when(purchaseVerification.hasDeliveredPurchase("buyer-1", "product-1", "order-1"))
                .thenReturn(false);
        when(contentSanitizer.sanitize("great product")).thenReturn("great product");
        when(reviewModeration.assess(any(ReviewModerationRequest.class)))
                .thenReturn(ReviewModerationDecision.REVIEW);
        when(reviewRepository.save(any(Review.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Review review = useCase.create(new CreateReviewCommand(
                "product-1", "buyer-1", "order-1", 5, "great product", java.util.List.of()));

        assertThat(review.verifiedPurchase()).isFalse();
    }

    @Test
    void automaticallyApprovesAReviewWhenTheModerationPortAllowsIt() {
        when(purchaseVerification.hasDeliveredPurchase("buyer-1", "product-1", "order-1"))
                .thenReturn(true);
        when(contentSanitizer.sanitize("<b>great product</b>")).thenReturn("great product");
        when(reviewModeration.assess(any(ReviewModerationRequest.class)))
                .thenReturn(ReviewModerationDecision.APPROVE);
        when(reviewRepository.save(any(Review.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Review review = useCase.create(new CreateReviewCommand(
                "product-1", "buyer-1", "order-1", 5, "<b>great product</b>", java.util.List.of()));

        assertThat(review.status()).isEqualTo(ReviewStatus.APPROVED);
        ArgumentCaptor<ReviewModerationRequest> request = ArgumentCaptor.forClass(ReviewModerationRequest.class);
        verify(reviewModeration).assess(request.capture());
        assertThat(request.getValue().text()).isEqualTo("great product");
        assertThat(request.getValue().verifiedPurchase()).isTrue();
    }

    @Test
    void persistsARejectedStatusWhenAProviderReturnsAHighConfidenceRejection() {
        when(purchaseVerification.hasDeliveredPurchase("buyer-1", "product-1", null)).thenReturn(false);
        when(contentSanitizer.sanitize("unsafe text")).thenReturn("unsafe text");
        when(reviewModeration.assess(any(ReviewModerationRequest.class)))
                .thenReturn(ReviewModerationDecision.REJECT);
        when(reviewRepository.save(any(Review.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Review review = useCase.create(new CreateReviewCommand(
                "product-1", "buyer-1", null, 1, "unsafe text", java.util.List.of()));

        assertThat(review.status()).isEqualTo(ReviewStatus.REJECTED);
    }
}
