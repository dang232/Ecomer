package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.domain.Order;

import java.util.List;

public record OrderResponse(
        String id,
        String orderNumber,
        String buyerId,
        AddressResponse shippingAddress,
        List<SubOrderResponse> subOrders,
        MoneyResponse itemsTotal,
        MoneyResponse shippingTotal,
        MoneyResponse discount,
        MoneyResponse taxTotal,
        MoneyResponse finalAmount,
        String paymentMethod,
        String paymentStatus,
        String idempotencyKey
) {

    static OrderResponse fromDomain(Order order) {
        return new OrderResponse(
                order.id().toString(),
                order.orderNumber(),
                order.buyerId(),
                AddressResponse.fromDomain(order.shippingAddress()),
                order.subOrders().stream().map(SubOrderResponse::fromDomain).toList(),
                MoneyResponse.fromDomain(order.itemsTotal()),
                MoneyResponse.fromDomain(order.shippingTotal()),
                MoneyResponse.fromDomain(order.discount()),
                MoneyResponse.fromDomain(order.taxTotal()),
                MoneyResponse.fromDomain(order.finalAmount()),
                order.paymentMethod(),
                order.paymentStatus().name(),
                order.idempotencyKey()
        );
    }
}
