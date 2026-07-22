package com.vnshop.productservice.application.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.ReviewStatus;
import com.vnshop.productservice.domain.review.port.out.BuyerProfileLookupPort;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdminReviewListUseCaseTest {
    @Test
    void pendingReviewsContainBuyerAndProductProjections() {
        Review review = new Review(
                UUID.randomUUID(), "product-1", "buyer-1", null, 4, "Useful",
                List.of(), false, 0, Set.of(), ReviewStatus.PENDING, Instant.parse("2026-07-22T00:00:00Z"));
        ReviewRepositoryPort reviews = mock(ReviewRepositoryPort.class);
        BuyerProfileLookupPort buyers = mock(BuyerProfileLookupPort.class);
        ProductRepositoryPort products = mock(ProductRepositoryPort.class);
        when(reviews.findByStatus(ReviewStatus.PENDING, "phone")).thenReturn(List.of(review));
        when(buyers.lookup(List.of("buyer-1"))).thenReturn(Map.of(
                "buyer-1", new BuyerProfileLookupPort.BuyerPublicProfile("buyer-1", "Alice Buyer", null)));
        when(products.findNamesByIds(Set.of("product-1"))).thenReturn(Map.of("product-1", "Phone Pro"));

        List<EnrichedReview> result = new AdminReviewListUseCase(reviews, buyers, products).pending("phone");

        assertThat(result).singleElement().satisfies(enriched -> {
            assertThat(enriched.userName()).isEqualTo("Alice Buyer");
            assertThat(enriched.productName()).isEqualTo("Phone Pro");
        });
    }
}
