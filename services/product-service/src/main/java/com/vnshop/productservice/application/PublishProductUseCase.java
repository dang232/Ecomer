package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ProductEventOutboxPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;

import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public class PublishProductUseCase {
    private final ProductRepositoryPort productRepositoryPort;
    private final ProductEventOutboxPort productEventOutboxPort;

    public PublishProductUseCase(ProductRepositoryPort productRepositoryPort,
            ProductEventOutboxPort productEventOutboxPort) {
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
        this.productEventOutboxPort = Objects.requireNonNull(productEventOutboxPort, "productEventOutboxPort is required");
    }

    @Transactional
    public ProductResponse publish(String sellerId, UUID productId) {
        Product product = productRepositoryPort.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("product not found"));
        if (!product.sellerId().equals(sellerId)) {
            throw new IllegalArgumentException("product does not belong to seller");
        }

        product.publish();
        Product saved = productRepositoryPort.save(product);
        productEventOutboxPort.enqueue(new ProductEvent(
                saved.productId().toString(),
                ProductEvent.EventType.UPDATED,
                null,
                ProductEventPayload.from(saved)));
        return ProductResponse.fromDomain(saved);
    }
}
