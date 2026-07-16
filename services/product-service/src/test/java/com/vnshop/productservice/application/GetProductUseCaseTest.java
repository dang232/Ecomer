package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductImage;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GetProductUseCaseTest {
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
