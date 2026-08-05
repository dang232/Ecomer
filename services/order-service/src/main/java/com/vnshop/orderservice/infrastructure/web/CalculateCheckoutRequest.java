package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.CheckoutOrderUseCase.CheckoutLineItem;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Wire shape for the checkout-preview endpoint. Mirrors the light shape
 * accepted by {@code POST /orders}: client sends only what it knows
 * ({@code productId, variantSku?, quantity}); the BE resolves seller,
 * name, and authoritative unit price from the product-service via
 * {@link com.vnshop.orderservice.domain.port.out.ProductCatalogPort}.
 *
 * <p>shippingAddress is intentionally absent — the current breakdown does
 * persists zero checkout shipping on {@code ShippingInfo.EMPTY}. When
 * destination-dependent carrier rates become part of the authoritative order
 * command, this record can grow it back in.
 */
public record CalculateCheckoutRequest(
        @Valid @NotEmpty List<OrderItemRequest> items,
        String couponCode
) {
    List<CheckoutLineItem> toLineItems() {
        return items.stream().map(OrderItemRequest::toLineItem).toList();
    }
}
