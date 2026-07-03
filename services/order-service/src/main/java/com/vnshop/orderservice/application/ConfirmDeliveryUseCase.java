package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;

import java.util.Objects;
import java.util.UUID;

/**
 * @deprecated Use {@link TransitionSubOrderUseCase#confirmDelivery(UUID, Long, String)} instead.
 */
@Deprecated
public class ConfirmDeliveryUseCase {
    private final TransitionSubOrderUseCase delegate;

    public ConfirmDeliveryUseCase(OrderRepositoryPort orderRepository,
                                  OrderEventPublisherPort orderEventPublisherPort) {
        this.delegate = new TransitionSubOrderUseCase(orderRepository,
                new NoopInventoryReservationPort(), orderEventPublisherPort);
    }

    public void confirm(UUID orderId, Long subOrderId, String buyerId) {
        delegate.confirmDelivery(orderId, subOrderId, buyerId);
    }

    private static final class NoopInventoryReservationPort implements InventoryReservationPort {
        @Override public void reserve(String orderId, java.util.List<com.vnshop.orderservice.domain.OrderItem> items) {}
        @Override public void release(String orderId) {}
    }
}
