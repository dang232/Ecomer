package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentMethod;

import java.util.List;

public record CreateOrderCommand(
        String buyerId,
        Address shippingAddress,
        List<OrderItem> items,
        String idempotencyKey,
        PaymentMethod paymentMethod) {

    public CreateOrderCommand(String buyerId, Address shippingAddress, List<OrderItem> items, String idempotencyKey) {
        this(buyerId, shippingAddress, items, idempotencyKey, PaymentMethod.COD);
    }
}
