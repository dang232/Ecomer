package com.vnshop.productservice.application.review;

import com.vnshop.productservice.domain.review.ProductReviewSummary;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProductReviewSummaryUseCaseTest {
    @Test
    void returnsBatchSummariesFromRepository() {
        ReviewRepositoryPort repository = mock(ReviewRepositoryPort.class);
        ProductReviewSummary summary = new ProductReviewSummary("product-1", 4.0d, 1L);
        when(repository.getProductReviewSummaries(Set.of("product-1")))
                .thenReturn(Map.of("product-1", summary));

        assertThat(new ProductReviewSummaryUseCase(repository).getSummaries(Set.of("product-1")))
                .containsEntry("product-1", summary);
    }

    @Test
    void rejectsEmptyProductIds() {
        assertThatThrownBy(() -> new ProductReviewSummaryUseCase(mock(ReviewRepositoryPort.class))
                .getSummaries(Set.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("productIds must not be empty");
    }
}
