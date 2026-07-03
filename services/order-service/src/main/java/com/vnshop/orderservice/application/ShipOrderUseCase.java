package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;

import java.util.Objects;
import java.util.UUID;

/**
 * @deprecated Use {@link TransitionSubOrderUseCase#ship(UUID, String, String, String)} instead.
 */
@Deprecated
public class ShipOrderUseCase {
    private final TransitionSubOrderUseCase delegate;

    public ShipOrderUseCase(OrderRepositoryPort orderRepository, OrderEventPublisherPort orderEventPublisherPort) {
        this.delegate = new TransitionSubOrderUseCase(orderRepository,
                new NoopInventoryReservationPort(), orderEventPublisherPort);
    }

    public Order ship(ShipOrderCommand command) {
        return delegate.ship(command.orderId(), command.sellerId(), command.carrier(), command.trackingNumber());
    }

    private static final class NoopInventoryReservationPort implements InventoryReservationPort {
        @Override public void reserve(String orderId, java.util.List<com.vnshop.orderservice.domain.OrderItem> items) {}
        @Override public void release(String orderId) {}
    }
}
