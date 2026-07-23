package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ProductEventOutboxPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;

import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public class DeleteProductUseCase {
    private final ProductRepositoryPort productRepositoryPort;
    private final ProductEventOutboxPort productEventOutboxPort;

    public DeleteProductUseCase(ProductRepositoryPort productRepositoryPort,
                                ProductEventOutboxPort productEventOutboxPort) {
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
        this.productEventOutboxPort = Objects.requireNonNull(productEventOutboxPort, "productEventOutboxPort is required");
    }

    @Transactional
    public void delete(UUID productId, String sellerId) {
        Product product = productRepositoryPort.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("product not found"));

        if (!product.sellerId().equals(sellerId)) {
            throw new IllegalArgumentException("product does not belong to seller");
        }

        product.softDelete();
        productRepositoryPort.save(product);
        productEventOutboxPort.enqueue(new ProductEvent(
                product.productId().toString(),
                ProductEvent.EventType.DELETED,
                null,
                java.util.Map.of("sellerId", product.sellerId())
        ));
    }
}
