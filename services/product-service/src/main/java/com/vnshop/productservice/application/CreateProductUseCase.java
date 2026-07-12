package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ProductEventPublisherPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.infrastructure.sanitization.HtmlSanitizer;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public class CreateProductUseCase {
    private final ProductRepositoryPort productRepositoryPort;
    private final ProductEventPublisherPort productEventPublisherPort;
    private final HtmlSanitizer htmlSanitizer;

    public CreateProductUseCase(ProductRepositoryPort productRepositoryPort,
                                ProductEventPublisherPort productEventPublisherPort,
                                HtmlSanitizer htmlSanitizer) {
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
        this.productEventPublisherPort = Objects.requireNonNull(productEventPublisherPort, "productEventPublisherPort is required");
        this.htmlSanitizer = Objects.requireNonNull(htmlSanitizer, "htmlSanitizer is required");
    }

    public ProductResponse create(CreateProductCommand command) {
        Product product = new Product(
                UUID.randomUUID(),
                command.sellerId(),
                command.name(),
                htmlSanitizer.sanitize(command.description()),
                command.categoryId(),
                command.brand(),
                command.variants(),
                command.images()
        );
        Product saved = productRepositoryPort.save(product);
        productEventPublisherPort.publish(new ProductEvent(
                saved.productId().toString(),
                ProductEvent.EventType.CREATED,
                null,
                Map.of(
                        "sellerId", saved.sellerId(),
                        "status", saved.status().name(),
                        "sameDayDelivery", saved.sameDayDelivery(),
                        "verified", saved.verified(),
                        "isOfficial", saved.isOfficial()
                )
        ));
        return ProductResponse.fromDomain(saved);
    }
}
