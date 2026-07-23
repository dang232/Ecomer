package com.vnshop.productservice.infrastructure.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.application.review.ProductRatingProjectionService;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import com.vnshop.productservice.infrastructure.persistence.review.ProductRatingProjectionBackfillJpaEntity;
import com.vnshop.productservice.infrastructure.persistence.review.ProductRatingProjectionBackfillSpringDataRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ProductRatingProjectionBackfillJobTest {
    private final ProductRatingProjectionBackfillSpringDataRepository markers =
            mock(ProductRatingProjectionBackfillSpringDataRepository.class);
    private final ReviewRepositoryPort reviews = mock(ReviewRepositoryPort.class);
    private final ProductRatingProjectionService projections = mock(ProductRatingProjectionService.class);
    private final ProductRatingProjectionBackfillJob job =
            new ProductRatingProjectionBackfillJob(markers, reviews, projections);

    @Test
    void queuesExistingReviewedProductsAndPersistsCompletion() {
        ProductRatingProjectionBackfillJpaEntity marker = new ProductRatingProjectionBackfillJpaEntity((short) 1);
        when(markers.findForUpdate((short) 1)).thenReturn(Optional.of(marker));
        when(reviews.findProductIdsWithApprovedReviews()).thenReturn(List.of("product-1", "product-2"));

        job.backfill();

        verify(projections).publish("product-1");
        verify(projections).publish("product-2");
        verify(markers).save(marker);
        assertThat(marker.isCompleted()).isTrue();
    }

    @Test
    void doesNotReplayAfterDurableCompletion() {
        ProductRatingProjectionBackfillJpaEntity marker = new ProductRatingProjectionBackfillJpaEntity((short) 1);
        marker.markCompleted();
        when(markers.findForUpdate((short) 1)).thenReturn(Optional.of(marker));

        job.backfill();

        verify(reviews, never()).findProductIdsWithApprovedReviews();
        verify(projections, never()).publish(org.mockito.ArgumentMatchers.anyString());
    }
}
