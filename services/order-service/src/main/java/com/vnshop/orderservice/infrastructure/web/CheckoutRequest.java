package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.CheckoutOrderUseCase.CheckoutLineItem;
import com.vnshop.orderservice.domain.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CheckoutRequest(
        @Valid @NotNull AddressRequest shippingAddress,
        @Valid @NotNull ShippingDetailsRequest shippingDetails,
        @Valid @NotEmpty List<OrderItemRequest> items,
        @NotNull PaymentMethod paymentMethod,
        String couponCode) {

    List<CheckoutLineItem> toLineItems() {
        return items.stream().map(OrderItemRequest::toLineItem).toList();
    }
}
