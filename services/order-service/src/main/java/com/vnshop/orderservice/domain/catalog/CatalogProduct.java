package com.vnshop.orderservice.domain.catalog;

import com.vnshop.orderservice.domain.Money;

import java.util.List;
import java.util.Optional;

/**
 * Snapshot of a product's catalog entry, sufficient to construct an
 * {@link com.vnshop.orderservice.domain.OrderItem} server-side. Sourced
 * from the product-service via {@link com.vnshop.orderservice.domain.port.out.ProductCatalogPort}.
 *
 * <p>Only fields the order-service actually needs at checkout time. Stock
 * and other details stay in the product-service.
 */
public record CatalogProduct(
        String productId,
        String sellerId,
        String name,
        List<Variant> variants,
        String imageUrl
) {
    public Optional<Variant> findVariant(String variantSku) {
        if (variantSku == null || variantSku.isBlank()) {
            return variants.stream().findFirst();
        }
        return variants.stream().filter(v -> variantSku.equals(v.sku())).findFirst();
    }

    public record Variant(String sku, Money unitPrice) {
    }
}
