package com.vnshop.productservice.infrastructure.persistence.review;

import com.vnshop.productservice.domain.review.ReviewStatus;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

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
