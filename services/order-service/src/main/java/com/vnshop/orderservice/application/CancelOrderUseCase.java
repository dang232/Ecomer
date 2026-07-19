package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.application.coupon.CouponRedemptionService;

import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import com.vnshop.orderservice.domain.annotation.Audited;

import org.springframework.transaction.annotation.Transactional;

public class CancelOrderUseCase {
    private static final Set<FulfillmentStatus> CANCELLABLE_STATUSES = Set.of(
            FulfillmentStatus.PENDING_ACCEPTANCE,
            FulfillmentStatus.ACCEPTED
    );

    private final OrderRepositoryPort orderRepository;
    private final InventoryReservationPort inventoryReservationPort;
    private final OrderEventPublisherPort orderEventPublisherPort;
    private final CouponRedemptionService couponRedemptionService;

    public CancelOrderUseCase(
            OrderRepositoryPort orderRepository,
            InventoryReservationPort inventoryReservationPort,
            OrderEventPublisherPort orderEventPublisherPort,
            CouponRedemptionService couponRedemptionService
    ) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        this.inventoryReservationPort = Objects.requireNonNull(inventoryReservationPort, "inventoryReservationPort is required");
        this.orderEventPublisherPort = Objects.requireNonNull(orderEventPublisherPort, "orderEventPublisherPort is required");
        this.couponRedemptionService = couponRedemptionService;
    }

    public CancelOrderUseCase(
            OrderRepositoryPort orderRepository,
            InventoryReservationPort inventoryReservationPort,
            OrderEventPublisherPort orderEventPublisherPort) {
        this(orderRepository, inventoryReservationPort, orderEventPublisherPort, null);
    }

    @Audited(action = "CANCEL_ORDER", resourceType = "Order")
    @Transactional
    public Order cancel(CancelOrderCommand command) {
        Objects.requireNonNull(command.id(), "orderId is required");
        requireNonBlank(command.buyerId(), "buyerId");
        Order order = orderRepository.findById(command.id())
                .orElseThrow(() -> new IllegalArgumentException("order not found: " + command.id()));
        if (!order.buyerId().equals(command.buyerId())) {
            throw new IllegalArgumentException("order does not belong to buyer: " + command.buyerId());
        }

        // BIZ-08: Guard cancellation by fulfillment status — reject if any sub-order
        // has already been shipped or delivered.
        boolean anyShippedOrDelivered = order.subOrders().stream()
                .anyMatch(sub -> sub.fulfillmentStatus() == FulfillmentStatus.SHIPPED
                        || sub.fulfillmentStatus() == FulfillmentStatus.DELIVERED);
        if (anyShippedOrDelivered) {
            throw new IllegalStateException("Cannot cancel — order already shipped/delivered");
        }

        order.subOrders().forEach(subOrder -> {
            if (CANCELLABLE_STATUSES.contains(subOrder.fulfillmentStatus())) {
                subOrder.cancel();
            }
        });
        inventoryReservationPort.release(order.id().toString());
        if (couponRedemptionService != null) {
            couponRedemptionService.release(order.id());
        }
        order.markPaymentFailed();
        Order savedOrder = orderRepository.save(order);
        orderEventPublisherPort.publishOrderUpdated(savedOrder);
        return savedOrder;
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
