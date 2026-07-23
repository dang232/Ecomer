package com.vnshop.productservice.application.review;

import com.vnshop.productservice.application.ProductEventPayload;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ProductEventOutboxPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.ProductReviewSummary;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;

import java.util.Objects;
import java.util.UUID;

/** Re-publishes the canonical product projection when approved review stats change. */
public class ProductRatingProjectionService {
    private final ProductRepositoryPort productRepositoryPort;
    private final ProductEventOutboxPort productEventOutboxPort;
    private final ReviewRepositoryPort reviewRepositoryPort;

    public ProductRatingProjectionService(
            ProductRepositoryPort productRepositoryPort,
            ProductEventOutboxPort productEventOutboxPort,
            ReviewRepositoryPort reviewRepositoryPort) {
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
        this.productEventOutboxPort = Objects.requireNonNull(productEventOutboxPort, "productEventOutboxPort is required");
        this.reviewRepositoryPort = Objects.requireNonNull(reviewRepositoryPort, "reviewRepositoryPort is required");
    }

    public void publish(String productId) {
        UUID id = UUID.fromString(productId);
        Product product = productRepositoryPort.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("product not found: " + productId));
        ProductReviewSummary summary = reviewRepositoryPort.getProductReviewSummary(productId);
        productEventOutboxPort.enqueue(new ProductEvent(
                productId,
                ProductEvent.EventType.UPDATED,
                null,
                ProductEventPayload.from(product, summary)));
    }
}
