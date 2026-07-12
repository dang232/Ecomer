package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ProductEventPublisherPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;

import java.util.Objects;
import java.util.UUID;

public class UpdateProductEligibilityUseCase {
    private final ProductRepositoryPort productRepositoryPort;
    private final ProductEventPublisherPort productEventPublisherPort;

    public UpdateProductEligibilityUseCase(
            ProductRepositoryPort productRepositoryPort,
            ProductEventPublisherPort productEventPublisherPort) {
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
        this.productEventPublisherPort = Objects.requireNonNull(
                productEventPublisherPort, "productEventPublisherPort is required");
    }

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
        productEventPublisherPort.publish(new ProductEvent(
                saved.productId().toString(),
                ProductEvent.EventType.UPDATED,
                null,
                ProductEventPayload.from(saved)));
        return ProductResponse.fromDomain(saved);
    }
}
