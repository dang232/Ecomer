package com.vnshop.productservice.infrastructure.event;

import com.vnshop.productservice.application.review.ProductRatingProjectionService;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import com.vnshop.productservice.infrastructure.persistence.review.ProductRatingProjectionBackfillJpaEntity;
import com.vnshop.productservice.infrastructure.persistence.review.ProductRatingProjectionBackfillSpringDataRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Enqueues one durable projection event for each existing reviewed product. */
@Service
@ConditionalOnProperty(
        name = "product.review-rating-projection.backfill.enabled",
        havingValue = "true",
        matchIfMissing = true)
public class ProductRatingProjectionBackfillJob {
    private static final Logger LOGGER = LoggerFactory.getLogger(ProductRatingProjectionBackfillJob.class);
    private static final short MARKER_ID = 1;

    private final ProductRatingProjectionBackfillSpringDataRepository markerRepository;
    private final ReviewRepositoryPort reviewRepository;
    private final ProductRatingProjectionService projectionService;

    public ProductRatingProjectionBackfillJob(
            ProductRatingProjectionBackfillSpringDataRepository markerRepository,
            ReviewRepositoryPort reviewRepository,
            ProductRatingProjectionService projectionService) {
        this.markerRepository = markerRepository;
        this.reviewRepository = reviewRepository;
        this.projectionService = projectionService;
    }

    @Scheduled(
            initialDelayString = "${product.review-rating-projection.backfill.initial-delay-ms:5000}",
            fixedDelayString = "${product.review-rating-projection.backfill.retry-delay-ms:60000}")
    @Transactional
    public void backfill() {
        ProductRatingProjectionBackfillJpaEntity marker = markerRepository.findForUpdate(MARKER_ID)
                .orElseThrow(() -> new IllegalStateException("rating projection backfill marker is missing"));
        if (marker.isCompleted()) {
            return;
        }

        List<String> productIds = reviewRepository.findProductIdsWithApprovedReviews();
        for (String productId : productIds) {
            projectionService.publish(productId);
        }
        marker.markCompleted();
        markerRepository.save(marker);
        LOGGER.info("Queued rating projections for {} existing reviewed products", productIds.size());
    }
}
