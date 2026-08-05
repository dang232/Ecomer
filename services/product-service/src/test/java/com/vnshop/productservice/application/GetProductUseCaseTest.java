package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductImage;
import com.vnshop.productservice.domain.ProductStatus;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.ProductReviewSummary;
import com.vnshop.productservice.domain.review.port.out.ProductRatingReadPort;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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

    @Test
    void sellerManagementListUsesOwnerScopedPagedRepositoryQuery() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        ProductRatingReadPort ratings = mock(ProductRatingReadPort.class);
        Product product = new Product(
                UUID.randomUUID(), "seller-1", "Headphones", "Description", "electronics", "Sony",
                List.of(new ProductVariant("sku-1", "Default", new Money(new BigDecimal("100"), "VND"), null, 5)),
                List.of());
        Pageable pageable = PageRequest.of(1, 2);
        Page<Product> page = new PageImpl<>(List.of(product), pageable, 3);
        when(repository.findSellerProducts("seller-1", "phone", "electronics", ProductStatus.DRAFT, pageable))
                .thenReturn(page);

        Page<ProductResponse> response = new GetProductUseCase(repository, ratings)
                .findSellerProducts("seller-1", "phone", "electronics", ProductStatus.DRAFT, pageable);

        assertThat(response.getContent()).extracting(ProductResponse::id)
                .containsExactly(product.productId().toString());
        assertThat(response.getTotalElements()).isEqualTo(3);
        verify(repository).findSellerProducts("seller-1", "phone", "electronics", ProductStatus.DRAFT, pageable);
    }

    @Test
    void sellerManagementDetailUsesOwnerScopedLookup() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        Product product = new Product(
                UUID.randomUUID(), "seller-1", "Headphones", "Description", "electronics", "Sony",
                List.of(new ProductVariant("sku-1", "Default", new Money(new BigDecimal("100"), "VND"), null, 5)),
                List.of());
        when(repository.findByIdAndSellerId(product.productId(), "seller-1"))
                .thenReturn(Optional.of(product));

        ProductResponse response = new GetProductUseCase(repository)
                .findSellerProductById(product.productId(), "seller-1");

        assertThat(response.id()).isEqualTo(product.productId().toString());
        verify(repository).findByIdAndSellerId(product.productId(), "seller-1");
    }

    @Test
    void sellerManagementDetailRejectsDeletedOrNonOwnedRows() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        Product deleted = new Product(
                UUID.randomUUID(), "seller-1", "Deleted headphones", "Description", "electronics", "Sony",
                ProductStatus.DELETED,
                List.of(new ProductVariant("sku-1", "Default", new Money(new BigDecimal("100"), "VND"), null, 5)),
                List.of(), List.of(), false, false, false);
        when(repository.findByIdAndSellerId(deleted.productId(), "seller-1"))
                .thenReturn(Optional.of(deleted));

        assertThatThrownBy(() -> new GetProductUseCase(repository)
                .findSellerProductById(deleted.productId(), "seller-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("product not found");

        Product foreign = new Product(
                UUID.randomUUID(), "seller-2", "Foreign headphones", "Description", "electronics", "Sony",
                List.of(new ProductVariant("sku-2", "Default", new Money(new BigDecimal("100"), "VND"), null, 5)),
                List.of());
        when(repository.findByIdAndSellerId(foreign.productId(), "seller-1"))
                .thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> new GetProductUseCase(repository)
                .findSellerProductById(foreign.productId(), "seller-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("product not found");
    }
}
