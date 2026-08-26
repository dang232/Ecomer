package com.vnshop.productservice.application.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.application.ProductAccessDeniedException;
import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.ProductQuestion;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.ReviewStatus;
import com.vnshop.productservice.domain.review.port.out.BuyerProfileLookupPort;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

class ReviewQuestionUseCasesTest {
    @Test
    void productReviews_enrichesKnownBuyersAndPreservesAnonymousFallback() {
        ReviewRepositoryPort reviews = mock(ReviewRepositoryPort.class);
        BuyerProfileLookupPort buyers = mock(BuyerProfileLookupPort.class);
        Review first = review("buyer-1");
        Review second = review("buyer-2");
        when(reviews.findApprovedByProductId("product-1", PageRequest.of(0, 2)))
                .thenReturn(new PageImpl<>(List.of(first, second)));
        when(buyers.lookup(List.of("buyer-1", "buyer-2")))
                .thenReturn(Map.of("buyer-1", new BuyerProfileLookupPort.BuyerPublicProfile("buyer-1", "Alice", "alice.png")));

        ProductReviewPage result = new GetProductReviewsUseCase(reviews, buyers)
                .get("product-1", PageRequest.of(0, 2));

        assertThat(result.page().getContent()).extracting(EnrichedReview::userName)
                .containsExactly("Alice", null);
        verify(reviews).getProductReviewSummary("product-1");
        verify(reviews).getProductReviewDistribution("product-1");
    }

    @Test
    void productReviews_emptyPageReturnsSummaryWithoutBuyerLookup() {
        ReviewRepositoryPort reviews = mock(ReviewRepositoryPort.class);
        BuyerProfileLookupPort buyers = mock(BuyerProfileLookupPort.class);
        PageRequest pageable = PageRequest.of(0, 2);
        when(reviews.findApprovedByProductId("product-1", pageable)).thenReturn(new PageImpl<>(List.of(), pageable, 0));

        ProductReviewPage result = new GetProductReviewsUseCase(reviews, buyers).get("product-1", pageable);

        assertThat(result.page()).isEmpty();
        verify(buyers, never()).lookup(any());
    }

    @Test
    void moderationListsApprovesWithProjectionAndRejectsWithReason() {
        ReviewRepositoryPort reviews = mock(ReviewRepositoryPort.class);
        ProductRatingProjectionService projection = mock(ProductRatingProjectionService.class);
        Review approved = review("buyer-1");
        when(reviews.moderate(any(UUID.class), org.mockito.ArgumentMatchers.eq(ReviewStatus.APPROVED))).thenReturn(approved);
        when(reviews.moderate(any(UUID.class), org.mockito.ArgumentMatchers.eq(ReviewStatus.REJECTED), org.mockito.ArgumentMatchers.eq("spam")))
                .thenReturn(approved);
        ModerateReviewUseCase useCase = new ModerateReviewUseCase(reviews, projection);

        assertThat(useCase.approve(approved.reviewId())).isSameAs(approved);
        assertThat(useCase.reject(approved.reviewId(), "spam")).isSameAs(approved);
        verify(projection).publish(approved.productId());
    }

    @Test
    void questionsRequireSellerOwnershipAndCanBeAskedAndListed() {
        ReviewRepositoryPort reviews = mock(ReviewRepositoryPort.class);
        ProductRepositoryPort products = mock(ProductRepositoryPort.class);
        Product product = product("seller-1");
        ProductQuestion question = ProductQuestion.asked(product.productId().toString(), "buyer-1", "When?");
        when(reviews.findQuestionById(question.questionId())).thenReturn(Optional.of(question));
        when(products.findById(product.productId())).thenReturn(Optional.of(product));
        when(reviews.saveQuestion(any(ProductQuestion.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProductQuestion answered = new AnswerQuestionUseCase(reviews, products)
                .answer(question.questionId(), "seller-1", "Tomorrow");
        assertThat(answered.answer()).isEqualTo("Tomorrow");
        assertThat(new AskQuestionUseCase(reviews).ask(new AskQuestionCommand("p", "b", "q")).question()).isEqualTo("q");
        when(reviews.findQuestionsByProductId("p")).thenReturn(List.of(question));
        assertThat(new GetQuestionsUseCase(reviews).get("p")).containsExactly(question);

        assertThatThrownBy(() -> new AnswerQuestionUseCase(reviews, products)
                .answer(question.questionId(), "seller-2", "Nope"))
                .isInstanceOf(ProductAccessDeniedException.class);
    }

    @Test
    void helpfulVoteIsIdempotentAndSavesOnlyNewVoter() {
        ReviewRepositoryPort reviews = mock(ReviewRepositoryPort.class);
        Review review = review("buyer-1");
        Review voted = review.withHelpfulVote("voter-1");
        when(reviews.findReviewById(review.reviewId())).thenReturn(Optional.of(review), Optional.of(voted));
        when(reviews.save(any(Review.class))).thenAnswer(invocation -> invocation.getArgument(0));
        VoteHelpfulUseCase useCase = new VoteHelpfulUseCase(reviews);

        Review firstVote = useCase.vote(review.reviewId(), "voter-1");
        Review repeated = new VoteHelpfulUseCase(reviews).vote(voted.reviewId(), "voter-1");

        assertThat(firstVote.helpfulVotes()).isEqualTo(1);
        assertThat(repeated).isSameAs(voted);
        verify(reviews).save(firstVote);
    }

    private static Review review(String buyerId) {
        return new Review(UUID.randomUUID(), "product-1", buyerId, "order-1", 5, "Great", List.of(), true, 0,
                java.util.Set.of(), ReviewStatus.APPROVED, Instant.parse("2026-01-01T00:00:00Z"));
    }

    private static Product product(String sellerId) {
        UUID id = UUID.randomUUID();
        return new Product(id, sellerId, "Phone", "desc", "electronics", "Acme",
                List.of(new ProductVariant("sku", "Default", new Money(BigDecimal.TEN), null, 1)), List.of());
    }
}
