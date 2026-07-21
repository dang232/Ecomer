package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ProductEventOutboxPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;

import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public class UpdateProductEligibilityUseCase {
    private final ProductRepositoryPort productRepositoryPort;
    private final ProductEventOutboxPort productEventOutboxPort;

    public UpdateProductEligibilityUseCase(
            ProductRepositoryPort productRepositoryPort,
            ProductEventOutboxPort productEventOutboxPort) {
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
        this.productEventOutboxPort = Objects.requireNonNull(
                productEventOutboxPort, "productEventOutboxPort is required");
    }

    @Transactional
    public ProductResponse update(
            UUID productId,
            boolean sameDayDelivery,
            boolean verified,
            boolean isOfficial) {
        Product product = productRepositoryPort.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("product not found"));
        product.setSameDayDelivery(sameDayDelivery);
        product.setVerified(verified);
        product.setOfficial(isOfficial);

        Product saved = productRepositoryPort.save(product);
        productEventOutboxPort.enqueue(new ProductEvent(
                saved.productId().toString(),
                ProductEvent.EventType.UPDATED,
                null,
                ProductEventPayload.from(saved)));
        return ProductResponse.fromDomain(saved);
    }
}
