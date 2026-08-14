package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentMethod;
import com.vnshop.orderservice.domain.ShippingDetails;

import java.util.List;

public record CreateOrderCommand(
        String buyerId,
        Address shippingAddress,
        ShippingDetails shippingDetails,
        List<OrderItem> items,
        String idempotencyKey,
        PaymentMethod paymentMethod,
        String couponCode) {

    public CreateOrderCommand(
            String buyerId,
            Address shippingAddress,
            List<OrderItem> items,
            String idempotencyKey,
            PaymentMethod paymentMethod,
            String couponCode) {
        this(buyerId, shippingAddress, null, items, idempotencyKey, paymentMethod, couponCode);
    }

    public CreateOrderCommand(
            String buyerId,
            Address shippingAddress,
            List<OrderItem> items,
            String idempotencyKey,
            PaymentMethod paymentMethod) {
        this(buyerId, shippingAddress, null, items, idempotencyKey, paymentMethod, null);
    }

    public CreateOrderCommand(String buyerId, Address shippingAddress, List<OrderItem> items, String idempotencyKey) {
        this(buyerId, shippingAddress, null, items, idempotencyKey, PaymentMethod.COD, null);
    }
}
