package com.vnshop.productservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.ProductStatus;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.port.out.ContentSanitizerPort;
import com.vnshop.productservice.domain.port.out.ProductEventOutboxPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.infrastructure.sanitization.HtmlSanitizer;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ProductLifecycleUseCasesTest {
    @Test
    void create_sanitizesSavesAndEnqueuesCreatedEvent() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        ProductEventOutboxPort outbox = mock(ProductEventOutboxPort.class);
        ContentSanitizerPort sanitizer = mock(ContentSanitizerPort.class);
        Product product = draft("seller-1");
        when(sanitizer.sanitize("<b>desc</b>")).thenReturn("desc");
        when(repository.save(any(Product.class))).thenReturn(product);

        ProductResponse response = new CreateProductUseCase(repository, outbox, sanitizer).create(
                new CreateProductCommand("seller-1", "Phone", "<b>desc</b>", "electronics", "Acme",
                        product.variants(), product.images()));

        assertThat(response.id()).isEqualTo(product.productId().toString());
        verify(sanitizer).sanitize("<b>desc</b>");
        verify(outbox).enqueue(any(ProductEvent.class));
    }

    @Test
    void update_appliesStatusTransitionsAndPublishes() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        ProductEventOutboxPort outbox = mock(ProductEventOutboxPort.class);
        Product existing = draft("seller-1");
        existing.publish();
        when(repository.findById(existing.productId())).thenReturn(Optional.of(existing));
        when(repository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProductResponse response = new UpdateProductUseCase(repository, outbox, new HtmlSanitizer()).update(
                "seller-1", existing.productId(), "Updated", "description", "electronics", "Acme",
                existing.variants(), existing.images(), existing.tags());

        assertThat(response.status()).isEqualTo(ProductStatus.ACTIVE.name());
        verify(outbox).enqueue(any(ProductEvent.class));
    }

    @Test
    void update_preservesInactiveAndOutOfStockStates() {
        for (ProductStatus status : List.of(ProductStatus.INACTIVE, ProductStatus.OUT_OF_STOCK)) {
            ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
            ProductEventOutboxPort outbox = mock(ProductEventOutboxPort.class);
            Product existing = new Product(existingId(), "seller-1", "Phone", "desc", "electronics", "Acme", status,
                    List.of(variant()), List.of(), List.of(), false, false, false);
            when(repository.findById(existing.productId())).thenReturn(Optional.of(existing));
            when(repository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

            ProductResponse response = new UpdateProductUseCase(repository, outbox, new HtmlSanitizer()).update(
                    "seller-1", existing.productId(), "Updated", "description", "electronics", "Acme",
                    existing.variants(), existing.images(), existing.tags());

            assertThat(response.status()).isEqualTo(status.name());
        }
    }

    @Test
    void update_rejectsMissingAndForeignProducts() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        ProductEventOutboxPort outbox = mock(ProductEventOutboxPort.class);
        UUID id = existingId();
        when(repository.findById(id)).thenReturn(Optional.empty());
        UpdateProductUseCase useCase = new UpdateProductUseCase(repository, outbox, new HtmlSanitizer());

        assertThatThrownBy(() -> useCase.update("seller-1", id, "n", "d", "c", "b", List.of(), List.of(), List.of()))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("product not found");

        Product foreign = draft("seller-2");
        when(repository.findById(foreign.productId())).thenReturn(Optional.of(foreign));
        assertThatThrownBy(() -> useCase.update("seller-1", foreign.productId(), "n", "d", "c", "b", List.of(), List.of(), List.of()))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("product does not belong to seller");
    }

    @Test
    void delete_softDeletesOwnedProductAndEnqueuesEvent() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        ProductEventOutboxPort outbox = mock(ProductEventOutboxPort.class);
        Product product = draft("seller-1");
        when(repository.findById(product.productId())).thenReturn(Optional.of(product));

        new DeleteProductUseCase(repository, outbox).delete(product.productId(), "seller-1");

        assertThat(product.status()).isEqualTo(ProductStatus.DELETED);
        verify(repository).save(product);
        ArgumentCaptor<ProductEvent> event = ArgumentCaptor.forClass(ProductEvent.class);
        verify(outbox).enqueue(event.capture());
        assertThat(event.getValue().eventType()).isEqualTo(ProductEvent.EventType.DELETED);
    }

    @Test
    void delete_rejectsMissingAndForeignProducts() {
        ProductRepositoryPort repository = mock(ProductRepositoryPort.class);
        ProductEventOutboxPort outbox = mock(ProductEventOutboxPort.class);
        UUID id = existingId();
        when(repository.findById(id)).thenReturn(Optional.empty());
        DeleteProductUseCase useCase = new DeleteProductUseCase(repository, outbox);
        assertThatThrownBy(() -> useCase.delete(id, "seller-1")).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("product not found");

        Product foreign = draft("seller-2");
        when(repository.findById(foreign.productId())).thenReturn(Optional.of(foreign));
        assertThatThrownBy(() -> useCase.delete(foreign.productId(), "seller-1"))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("product does not belong to seller");
    }

    private static Product draft(String sellerId) {
        return new Product(existingId(), sellerId, "Phone", "desc", "electronics", "Acme",
                List.of(variant()), List.of());
    }

    private static ProductVariant variant() {
        return new ProductVariant("sku-1", "Default", new Money(BigDecimal.TEN), null, 1);
    }

    private static UUID existingId() {
        return UUID.randomUUID();
    }
}
