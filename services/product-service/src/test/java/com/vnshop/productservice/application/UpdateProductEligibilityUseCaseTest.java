package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.port.out.ProductEventOutboxPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UpdateProductEligibilityUseCaseTest {
    @Test
    void updatesFlagsAndPublishesCompleteSearchPayload() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        ProductEventOutboxPort outbox = mock(ProductEventOutboxPort.class);
        UUID productId = UUID.randomUUID();
        Product product = new Product(
                productId,
                "seller-1",
                "Phone",
                "Description",
                "electronics",
                "VNShop",
                List.of(new ProductVariant("SKU-1", "Default", new Money(new BigDecimal("120000")), null, 5)),
                List.of());
        when(repository.findById(productId)).thenReturn(Optional.of(product));
        when(repository.save(product)).thenReturn(product);
        UpdateProductEligibilityUseCase useCase = new UpdateProductEligibilityUseCase(repository, outbox);

        ProductResponse response = useCase.update(productId, true, true, true);

        assertThat(response.sameDayDelivery()).isTrue();
        assertThat(response.verified()).isTrue();
        assertThat(response.isOfficial()).isTrue();
        ArgumentCaptor<ProductEvent> event = ArgumentCaptor.forClass(ProductEvent.class);
        verify(outbox).enqueue(event.capture());
        assertThat(event.getValue().payload())
                .containsEntry("name", "Phone")
                .containsEntry("categoryId", "electronics")
                .containsEntry("minPrice", new BigDecimal("120000"))
                .containsEntry("variantCount", 1)
                .containsEntry("sameDayDelivery", true)
                .containsEntry("verified", true)
                .containsEntry("isOfficial", true);
    }
}
