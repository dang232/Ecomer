package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductImage;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.ProductReviewSummary;
import com.vnshop.productservice.domain.review.port.out.ProductRatingReadPort;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

class GetProductUseCaseTest {
    @Test
    void catalogReadsRatingsInOneBatchAndMapsThemToResponses() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        ProductRatingReadPort ratings = mock(ProductRatingReadPort.class);
        Product product = new Product(
                UUID.randomUUID(), "seller-1", "Headphones", "Description", "electronics", "Sony",
                List.of(new ProductVariant("sku-1", "Default", new Money(new BigDecimal("100"), "VND"), null, 5)),
                List.of());
        when(repository.findBySellerId("seller-1")).thenReturn(List.of(product));
        when(ratings.getProductReviewSummaries(Set.of(product.productId().toString())))
                .thenReturn(Map.of(product.productId().toString(), new ProductReviewSummary(4.0, 1)));

        ProductResponse response = new GetProductUseCase(repository, ratings)
                .findBySeller("seller-1")
                .getFirst();

        assertThat(response.rating()).isEqualTo(4.0);
        assertThat(response.reviewCount()).isEqualTo(1);
        verify(ratings).getProductReviewSummaries(Set.of(product.productId().toString()));
    }

    @Test
    void publicDetailRejectsDraftProducts() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        Product product = new Product(
                UUID.randomUUID(), "seller-1", "Headphones", "Description", "electronics", "Sony",
                List.of(new ProductVariant("sku-1", "Default", new Money(new BigDecimal("100"), "VND"), null, 5)),
                List.of(new ProductImage("https://example.test/headphones.webp", "Headphones", 1)));
        when(repository.findById(product.productId())).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> new GetProductUseCase(repository).findPublicById(product.productId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("product not found");
    }
}
