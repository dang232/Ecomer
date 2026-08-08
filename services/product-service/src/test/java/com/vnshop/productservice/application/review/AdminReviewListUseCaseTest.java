package com.vnshop.productservice.application.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.ArgumentMatchers.any;

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
    void cursorPageEnrichesOnlyVisibleRowsAndReportsLookahead() {
        Review visible = review("visible", "2026-07-22T00:00:00Z");
        Review lookahead = review("lookahead", "2026-07-21T00:00:00Z");
        ReviewRepositoryPort reviews = mock(ReviewRepositoryPort.class);
        BuyerProfileLookupPort buyers = mock(BuyerProfileLookupPort.class);
        ProductRepositoryPort products = mock(ProductRepositoryPort.class);
        when(reviews.findByStatusCursor(ReviewStatus.PENDING, "", null, 2)).thenReturn(List.of(visible, lookahead));
        when(buyers.lookup(List.of("buyer-visible"))).thenReturn(Map.of());
        when(products.findNamesByIds(Set.of("product-visible"))).thenReturn(Map.of());

        AdminReviewCursorPage result = new AdminReviewListUseCase(reviews, buyers, products)
                .pendingCursor("", null, 1);

        assertThat(result.items()).singleElement().extracting(EnrichedReview::review).isEqualTo(visible);
        assertThat(result.hasMore()).isTrue();
        verify(buyers).lookup(List.of("buyer-visible"));
        verify(products).findNamesByIds(Set.of("product-visible"));
        verify(buyers, never()).lookup(List.of("buyer-lookahead"));
    }

    private static Review review(String id, String createdAt) {
        return new Review(UUID.nameUUIDFromBytes(id.getBytes()), "product-" + id,
                "buyer-" + id, null, 4, id, List.of(), false, 0, Set.of(), ReviewStatus.PENDING,
                Instant.parse(createdAt));
    }

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
