package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.ProductImage;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.port.out.ProductEventPublisherPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.infrastructure.sanitization.HtmlSanitizer;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

public class UpdateProductUseCase {
    private final ProductRepositoryPort productRepositoryPort;
    private final ProductEventPublisherPort productEventPublisherPort;
    private final HtmlSanitizer htmlSanitizer;

    public UpdateProductUseCase(ProductRepositoryPort productRepositoryPort,
                                ProductEventPublisherPort productEventPublisherPort,
                                HtmlSanitizer htmlSanitizer) {
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
        this.productEventPublisherPort = Objects.requireNonNull(productEventPublisherPort, "productEventPublisherPort is required");
        this.htmlSanitizer = Objects.requireNonNull(htmlSanitizer, "htmlSanitizer is required");
    }

    public ProductResponse update(
            String sellerId,
            UUID productId,
            String name,
            String description,
            String categoryId,
            String brand,
            List<ProductVariant> variants,
            List<ProductImage> images
    ) {
        Product existing = productRepositoryPort.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("product not found"));
        if (!existing.sellerId().equals(sellerId)) {
            throw new IllegalArgumentException("product does not belong to seller");
        }
        Product updated = new Product(productId, sellerId, name, htmlSanitizer.sanitize(description), categoryId, brand, variants, images,
                existing.sameDayDelivery(), existing.verified(), existing.isOfficial());
        if (existing.status().name().equals("ACTIVE")) {
            updated.publish();
        } else if (existing.status().name().equals("INACTIVE")) {
            updated.publish();
            updated.deactivate();
        } else if (existing.status().name().equals("OUT_OF_STOCK")) {
            updated.setOutOfStock();
        }
        Product saved = productRepositoryPort.save(updated);
        productEventPublisherPort.publish(new ProductEvent(
                saved.productId().toString(),
                ProductEvent.EventType.UPDATED,
                null,
                ProductEventPayload.from(saved)
        ));
        return ProductResponse.fromDomain(saved);
    }
}
