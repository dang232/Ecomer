package com.vnshop.orderservice.domain.port.out;

import com.vnshop.orderservice.domain.catalog.CatalogProduct;

import java.util.Optional;

/**
 * Reads canonical product details (seller, variants, prices) from the
 * product-service. Used by the checkout path to resolve light client-supplied
 * line items ({@code productId, variantSku?, quantity}) into the full
 * denormalized {@link com.vnshop.orderservice.domain.OrderItem} shape the
 * domain requires — and, critically, to guarantee the BE-side authoritative
 * unit price (preventing client-side price tampering).
 */
public interface ProductCatalogPort {
    Optional<CatalogProduct> findByProductId(String productId);
}
