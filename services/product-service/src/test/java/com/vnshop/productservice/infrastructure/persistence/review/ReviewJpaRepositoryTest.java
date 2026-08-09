package com.vnshop.productservice.infrastructure.persistence.review;

import com.vnshop.productservice.domain.review.ReviewStatus;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReviewJpaRepositoryTest {
    @Test
    void reviewUpdatesKeepTheOriginalCreatedAt() {
        Instant createdAt = Instant.parse("2026-07-15T10:00:00Z");
        com.vnshop.productservice.domain.review.Review review = new com.vnshop.productservice.domain.review.Review(
                UUID.randomUUID(), "product-1", "buyer-1", null, 5, "great", List.of(), false, 0,
                Set.of(), ReviewStatus.PENDING, createdAt);

        ReviewJpaEntity entity = ReviewJpaEntity.fromDomain(review.withStatus(ReviewStatus.APPROVED));

        assertThat(entity.toDomain().createdAt()).isEqualTo(createdAt);
    }

    @Test
    void publicReviewsUseApprovedStatusOnly() {
        ReviewJpaSpringDataRepository springData = mock(ReviewJpaSpringDataRepository.class);
        QuestionJpaSpringDataRepository questions = mock(QuestionJpaSpringDataRepository.class);
        when(springData.findByProductIdAndStatus("product-1", ReviewStatus.APPROVED)).thenReturn(List.of());

        assertThat(new ReviewJpaRepository(springData, questions).findByProductId("product-1")).isEmpty();

        verify(springData).findByProductIdAndStatus("product-1", ReviewStatus.APPROVED);
        verify(springData, never()).findByProductId("product-1");
    }

    @Test
    void publicReviewPagesUseApprovedStatusAndStableNewestFirstOrder() {
        ReviewJpaSpringDataRepository springData = mock(ReviewJpaSpringDataRepository.class);
        QuestionJpaSpringDataRepository questions = mock(QuestionJpaSpringDataRepository.class);
        PageRequest pageable = PageRequest.of(1, 20);
        when(springData.findByProductIdAndStatusOrderByCreatedAtDescReviewIdDesc(
                "product-1", ReviewStatus.APPROVED, pageable)).thenReturn(Page.empty(pageable));

        assertThat(new ReviewJpaRepository(springData, questions)
                .findApprovedByProductId("product-1", pageable)).isEmpty();

        verify(springData).findByProductIdAndStatusOrderByCreatedAtDescReviewIdDesc(
                "product-1", ReviewStatus.APPROVED, pageable);
    }

    @Test
    void publicReviewQueryHasDeterministicOrdering() throws NoSuchMethodException {
        Method method = ReviewJpaSpringDataRepository.class.getMethod(
                "findByProductIdAndStatusOrderByCreatedAtDescReviewIdDesc",
                String.class, ReviewStatus.class, org.springframework.data.domain.Pageable.class);

        assertThat(method.getName()).contains("OrderByCreatedAtDescReviewIdDesc");
    }

    @Test
    void adminReviewSearchNormalizesTheOperatorQuery() {
        ReviewJpaSpringDataRepository springData = mock(ReviewJpaSpringDataRepository.class);
        QuestionJpaSpringDataRepository questions = mock(QuestionJpaSpringDataRepository.class);
        when(springData.findByStatusAndQuery("PENDING", "headphones")).thenReturn(List.of());

        assertThat(new ReviewJpaRepository(springData, questions)
                .findByStatus(ReviewStatus.PENDING, "  HeadPhones "))
                .isEmpty();

        verify(springData).findByStatusAndQuery("PENDING", "headphones");
    }

    @Test
    void adminCursorQueryUsesKeysetWithoutCountOrOffset() throws NoSuchMethodException {
        String query = queryFor("findPendingCursorAfter");
        assertThat(query).contains("r.created_at < :anchorCreatedAt")
                .contains("r.review_id < :anchorReviewId")
                .contains("ORDER BY r.created_at DESC, r.review_id DESC")
                .doesNotContain("COUNT(").doesNotContain("OFFSET");
    }

    @Test
    void sellerAggregatesFilterOutUnapprovedReviews() throws NoSuchMethodException {
        assertThat(queryFor("findSellerReviewStats")).contains("r.status = 'APPROVED'");
        assertThat(queryFor("findSellerReviewStatsBatch")).contains("r.status = 'APPROVED'");
    }

    @Test
    void ratingBackfillOnlySelectsExistingProductsWithApprovedReviews() throws NoSuchMethodException {
        assertThat(queryFor("findProductIdsWithApprovedReviews"))
                .contains("JOIN product_svc.products")
                .contains("r.status = 'APPROVED'");
    }

    private static String queryFor(String methodName) throws NoSuchMethodException {
        Method method = List.of(ReviewJpaSpringDataRepository.class.getMethods()).stream()
                .filter(candidate -> candidate.getName().equals(methodName))
                .findFirst()
                .orElseThrow();
        return method.getAnnotation(Query.class).value();
    }
}
