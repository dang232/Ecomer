package com.vnshop.productservice.application.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.port.out.ProductEventOutboxPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.ProductReviewSummary;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ProductRatingProjectionServiceTest {
    private final ProductRepositoryPort products = mock(ProductRepositoryPort.class);
    private final ProductEventOutboxPort outbox = mock(ProductEventOutboxPort.class);
    private final ReviewRepositoryPort reviews = mock(ReviewRepositoryPort.class);

    @Test
    void publishesCanonicalProductEventWithApprovedRatingAggregate() {
        UUID productId = UUID.randomUUID();
        Product product = new Product(
                productId, "seller-1", "Headphones", "desc", "audio", "Acme",
                List.of(new ProductVariant("black", "Black", new Money(new BigDecimal("100")), null, 2)),
                List.of());
        when(products.findById(productId)).thenReturn(Optional.of(product));
        when(reviews.getProductReviewSummary(productId.toString()))
                .thenReturn(new ProductReviewSummary(4.0, 1));

        new ProductRatingProjectionService(products, outbox, reviews).publish(productId.toString());

        ArgumentCaptor<ProductEvent> event = ArgumentCaptor.forClass(ProductEvent.class);
        verify(outbox).enqueue(event.capture());
        assertThat(event.getValue().eventType()).isEqualTo(ProductEvent.EventType.UPDATED);
        assertThat(event.getValue().payload())
                .containsEntry("averageRating", 4.0)
                .containsEntry("reviewCount", 1L);
    }
}
