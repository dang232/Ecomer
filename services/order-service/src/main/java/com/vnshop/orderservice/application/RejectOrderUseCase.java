package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;

import java.util.Objects;
import java.util.UUID;

/**
 * @deprecated Use {@link TransitionSubOrderUseCase#reject(UUID, String)} instead.
 */
@Deprecated
public class RejectOrderUseCase {
    private final TransitionSubOrderUseCase delegate;

    public RejectOrderUseCase(
            OrderRepositoryPort orderRepository,
            InventoryReservationPort inventoryReservationPort,
            OrderEventPublisherPort orderEventPublisherPort
    ) {
        this.delegate = new TransitionSubOrderUseCase(orderRepository, inventoryReservationPort, orderEventPublisherPort);
    }

    public Order reject(UUID orderId, String sellerId) {
        return delegate.reject(orderId, sellerId);
    }
}
