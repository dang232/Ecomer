package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.projection.OrderSummaryProjection;
import com.vnshop.orderservice.domain.port.out.OrderSummaryQueryPort;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.transaction.annotation.Transactional;

public class AdminOrderUseCase {

    private final OrderRepositoryPort orderRepository;
    private final OrderSummaryQueryPort orderSummaryQueryPort;
    private final InventoryReservationPort inventoryReservationPort;
    private final OrderEventPublisherPort orderEventPublisherPort;

    public AdminOrderUseCase(
            OrderRepositoryPort orderRepository,
            OrderSummaryQueryPort orderSummaryQueryPort,
            InventoryReservationPort inventoryReservationPort,
            OrderEventPublisherPort orderEventPublisherPort
    ) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        this.orderSummaryQueryPort = Objects.requireNonNull(orderSummaryQueryPort, "orderSummaryQueryPort is required");
        this.inventoryReservationPort = Objects.requireNonNull(inventoryReservationPort, "inventoryReservationPort is required");
        this.orderEventPublisherPort = Objects.requireNonNull(orderEventPublisherPort, "orderEventPublisherPort is required");
    }

    /**
     * Returns a flat list of all order summaries, optionally filtered by a
     * fulfillment status string. Used by the admin order management panel.
     */
    public List<OrderSummaryProjection> listAllOrders(String status) {
        return orderSummaryQueryPort.findAll(status);
    }

    /**
     * Returns all order summaries for a specific buyer. Used by the admin
     * user management panel to view a user's order history.
     */
    public List<OrderSummaryProjection> listOrdersByBuyer(String buyerId) {
        return orderSummaryQueryPort.findByBuyerId(buyerId);
    }

    /**
     * Force-cancels every non-terminal sub-order of an order, releases
     * inventory, and marks payment as failed.
     */
    @Transactional
    public Order forceCancel(UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("order not found: " + orderId));
        order.subOrders().forEach(subOrder -> {
            FulfillmentStatus fs = subOrder.fulfillmentStatus();
            if (fs == FulfillmentStatus.PENDING_ACCEPTANCE || fs == FulfillmentStatus.ACCEPTED) {
                subOrder.cancel();
            }
        });
        inventoryReservationPort.release(order.id().toString());
        order.markPaymentFailed();
        Order saved = orderRepository.save(order);
        orderEventPublisherPort.publishOrderUpdated(saved);
        return saved;
    }

    /**
     * Marks the order as disputed (triggers downstream refund flow via events).
     */
    @Transactional
    public Order forceRefund(UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("order not found: " + orderId));
        order.markPaymentDisputed();
        Order saved = orderRepository.save(order);
        orderEventPublisherPort.publishOrderUpdated(saved);
        return saved;
    }

    /**
     * Advances every sub-order of the order to the requested fulfillment
     * status where the transition is valid. Sub-orders already in or past the
     * target state are silently skipped.
     */
    @Transactional
    public Order changeStatus(UUID orderId, String targetStatus) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("order not found: " + orderId));
        FulfillmentStatus target = FulfillmentStatus.valueOf(targetStatus.toUpperCase());
        order.subOrders().forEach(subOrder -> {
            try {
                switch (target) {
                    case ACCEPTED -> subOrder.accept();
                    case PACKED -> subOrder.pack();
                    case SHIPPED -> subOrder.ship("ADMIN", "ADMIN-OVERRIDE");
                    case CANCELLED -> subOrder.cancel();
                    default -> { /* PENDING_ACCEPTANCE, REJECTED, DELIVERED not admin-settable */ }
                }
            } catch (IllegalStateException ignored) {
                // Sub-order already in this or a later state.
            }
        });
        Order saved = orderRepository.save(order);
        orderEventPublisherPort.publishOrderUpdated(saved);
        return saved;
    }
}
