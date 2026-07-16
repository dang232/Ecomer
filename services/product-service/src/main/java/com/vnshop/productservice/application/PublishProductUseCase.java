package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ProductEventPublisherPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;

import java.util.Objects;
import java.util.UUID;

public class PublishProductUseCase {
    private final ProductRepositoryPort productRepositoryPort;
    private final ProductEventPublisherPort productEventPublisherPort;

    public PublishProductUseCase(ProductRepositoryPort productRepositoryPort,
            ProductEventPublisherPort productEventPublisherPort) {
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
        this.productEventPublisherPort = Objects.requireNonNull(productEventPublisherPort, "productEventPublisherPort is required");
    }

    public ProductResponse publish(String sellerId, UUID productId) {
        Product product = productRepositoryPort.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("product not found"));
        if (!product.sellerId().equals(sellerId)) {
            throw new IllegalArgumentException("product does not belong to seller");
        }

        product.publish();
        Product saved = productRepositoryPort.save(product);
        productEventPublisherPort.publish(new ProductEvent(
                saved.productId().toString(),
                ProductEvent.EventType.UPDATED,
                null,
                ProductEventPayload.from(saved)));
        return ProductResponse.fromDomain(saved);
    }
}
