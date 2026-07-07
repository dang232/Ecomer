package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;

import java.util.Objects;
import java.util.UUID;

import org.springframework.transaction.annotation.Transactional;

public class AcceptOrderUseCase {
    private final OrderRepositoryPort orderRepository;
    private final OrderEventPublisherPort orderEventPublisherPort;

    public AcceptOrderUseCase(OrderRepositoryPort orderRepository, OrderEventPublisherPort orderEventPublisherPort) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        this.orderEventPublisherPort = Objects.requireNonNull(orderEventPublisherPort, "orderEventPublisherPort is required");
    }

    @Transactional
    public Order accept(UUID orderId, String sellerId) {
        Order order = findOrder(orderId);
        findSellerSubOrder(order, sellerId).accept();
        Order savedOrder = orderRepository.save(order);
        orderEventPublisherPort.publishOrderUpdated(savedOrder);
        return savedOrder;
    }

    private Order findOrder(UUID orderId) {
        Objects.requireNonNull(orderId, "orderId is required");
        // Pt40 audit: same fold as Ship/Reject. Status-code parity with
        // the ownership-rejection branch closes the existence-probe
        // oracle on order UUIDs (gotcha #106).
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderAccessDeniedException("not authorized to accept this order"));
    }

    private SubOrder findSellerSubOrder(Order order, String sellerId) {
        requireNonBlank(sellerId, "sellerId");
        return order.subOrders().stream()
                .filter(subOrder -> subOrder.sellerId().equals(sellerId))
                .findFirst()
                // Pt37 audit: same fix as ShipOrderUseCase. 403 (not 400)
                // and a generic message so the response can't be used to
                // probe whether a given sellerId has a sub-order on
                // someone else's order.
                .orElseThrow(() -> new OrderAccessDeniedException("not authorized to accept this order"));
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
