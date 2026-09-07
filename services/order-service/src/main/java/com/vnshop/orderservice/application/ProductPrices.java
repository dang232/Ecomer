package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Money;

/**
 * Shared pricing guards for checkout paths. Both the preview
 * ({@link CalculateCheckoutUseCase}) and the order placement
 * ({@link CheckoutOrderUseCase}) must fail closed on missing or
 * non-positive authoritative prices — a single helper keeps the
 * rule identical in both places.
 */
public final class ProductPrices {

    private ProductPrices() {
    }

    public static void requirePositive(Money unitPrice, String productId) {
        if (unitPrice == null || unitPrice.amount() == null || unitPrice.amount().signum() <= 0) {
            throw new InvalidProductPriceException("authoritative price unavailable for productId=" + productId);
        }
    }
}
