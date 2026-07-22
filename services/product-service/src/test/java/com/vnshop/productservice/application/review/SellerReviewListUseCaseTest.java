package com.vnshop.productservice.application.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Page;

class SellerReviewListUseCaseTest {
    @Test
    void listsOnlyTheSellerPageAndEnrichesBuyerAndProductContext() {
        Review review = new Review(
                UUID.randomUUID(), "product-1", "buyer-1", "order-1", 5, "Great phone",
                List.of(), true, 0, Set.of(), ReviewStatus.APPROVED, Instant.parse("2026-07-22T00:00:00Z"));
        ReviewRepositoryPort reviews = mock(ReviewRepositoryPort.class);
        BuyerProfileLookupPort buyers = mock(BuyerProfileLookupPort.class);
        ProductRepositoryPort products = mock(ProductRepositoryPort.class);
        PageRequest pageRequest = PageRequest.of(0, 20);
        when(reviews.findApprovedBySellerId("seller-1", "phone", pageRequest))
                .thenReturn(new PageImpl<>(List.of(review), pageRequest, 1));
        when(buyers.lookup(List.of("buyer-1"))).thenReturn(Map.of(
                "buyer-1", new BuyerProfileLookupPort.BuyerPublicProfile("buyer-1", "Alice Buyer", "/avatar.png")));
        when(products.findNamesByIds(Set.of("product-1"))).thenReturn(Map.of("product-1", "Phone Pro"));

        Page<EnrichedReview> result = new SellerReviewListUseCase(reviews, buyers, products)
                .list("seller-1", "phone", pageRequest);

        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent().getFirst().userName()).isEqualTo("Alice Buyer");
        assertThat(result.getContent().getFirst().productName()).isEqualTo("Phone Pro");
        verify(reviews).findApprovedBySellerId("seller-1", "phone", pageRequest);
        verify(buyers).lookup(List.of("buyer-1"));
        verify(products).findNamesByIds(Set.of("product-1"));
    }
}
