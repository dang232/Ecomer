package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * @deprecated Use {@link TransitionSubOrderUseCase#accept(UUID, String)} instead.
 */
@Deprecated
public class AcceptOrderUseCase {
    private final TransitionSubOrderUseCase delegate;

    public AcceptOrderUseCase(OrderRepositoryPort orderRepository, OrderEventPublisherPort orderEventPublisherPort) {
        this.delegate = new TransitionSubOrderUseCase(orderRepository,
                new NoopInventoryReservationPort(), orderEventPublisherPort);
    }

    public Order accept(UUID orderId, String sellerId) {
        return delegate.accept(orderId, sellerId);
    }

    private static final class NoopInventoryReservationPort implements InventoryReservationPort {
        @Override public void reserve(String orderId, java.util.List<com.vnshop.orderservice.domain.OrderItem> items) {}
        @Override public void release(String orderId) {}
    }
}
