package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ContentSanitizerPort;
import com.vnshop.productservice.domain.port.out.ProductEventPublisherPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;

import java.util.Objects;
import java.util.UUID;

public class CreateProductUseCase {
    private final ProductRepositoryPort productRepositoryPort;
    private final ProductEventPublisherPort productEventPublisherPort;
    private final ContentSanitizerPort contentSanitizer;

    public CreateProductUseCase(ProductRepositoryPort productRepositoryPort,
                                ProductEventPublisherPort productEventPublisherPort,
                                ContentSanitizerPort contentSanitizer) {
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
        this.productEventPublisherPort = Objects.requireNonNull(productEventPublisherPort, "productEventPublisherPort is required");
        this.contentSanitizer = Objects.requireNonNull(contentSanitizer, "contentSanitizer is required");
    }

    public ProductResponse create(CreateProductCommand command) {
        Product product = new Product(
                UUID.randomUUID(),
                command.sellerId(),
                command.name(),
                contentSanitizer.sanitize(command.description()),
                command.categoryId(),
                command.brand(),
                command.variants(),
                command.images(),
                command.sameDayDelivery(),
                command.verified(),
                command.isOfficial()
        );
        Product saved = productRepositoryPort.save(product);
        productEventPublisherPort.publish(new ProductEvent(
                saved.productId().toString(),
                ProductEvent.EventType.CREATED,
                null,
                ProductEventPayload.from(saved)
        ));
        return ProductResponse.fromDomain(saved);
    }
}
