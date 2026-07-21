package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.ProductImage;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.port.out.ProductEventOutboxPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PublishProductUseCaseTest {
    private static final String SELLER_ID = "seller-1";

    @Test
    void publishesDraftProductAndEmitsActiveProjectionEvent() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        ProductEventOutboxPort outbox = mock(ProductEventOutboxPort.class);
        Product product = draftProduct();
        when(repository.findById(product.productId())).thenReturn(Optional.of(product));
        when(repository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProductResponse response = new PublishProductUseCase(repository, outbox)
                .publish(SELLER_ID, product.productId());

        assertThat(response.status()).isEqualTo("ACTIVE");
        verify(outbox).enqueue(org.mockito.ArgumentMatchers.argThat(event ->
                event.eventType() == ProductEvent.EventType.UPDATED
                        && "ACTIVE".equals(event.payload().get("status"))));
    }

    @Test
    void refusesToPublishAProductOwnedByAnotherSeller() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        ProductEventOutboxPort outbox = mock(ProductEventOutboxPort.class);
        Product product = draftProduct();
        when(repository.findById(product.productId())).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> new PublishProductUseCase(repository, outbox)
                .publish("seller-2", product.productId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not belong to seller");
    }

    private static Product draftProduct() {
        return new Product(
                UUID.randomUUID(),
                SELLER_ID,
                "Headphones",
                "Noise cancelling headphones",
                "electronics",
                "Sony",
                List.of(new ProductVariant("sku-1", "Default", new Money(new BigDecimal("100"), "VND"), null, 5)),
                List.of(new ProductImage("https://example.test/headphones.webp", "Headphones", 1)));
    }
}
