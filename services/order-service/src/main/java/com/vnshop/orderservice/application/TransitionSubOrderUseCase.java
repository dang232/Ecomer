package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.annotation.Audited;

import java.util.Objects;
import java.util.UUID;

/**
 * Unified use case for seller and buyer sub-order state transitions.
 * Replaces: AcceptOrderUseCase, RejectOrderUseCase, ShipOrderUseCase, ConfirmDeliveryUseCase.
 *
 * <p>All four transitions share the same ownership-gating pattern (OAD with constant message,
 * pt37/38/39/40 audit) and the same find-order / find-seller-suborder structure.
 * The only behavioural differences are:
 * <ul>
 *   <li>REJECT also releases inventory reservation</li>
 *   <li>SHIP also calls pack() + ship(carrier, tracking) on the aggregate</li>
 *   <li>CONFIRM_DELIVERY uses buyerId instead of sellerId and publishes publishOrderDelivered</li>
 * </ul>
 */
public class TransitionSubOrderUseCase {

    private final OrderRepositoryPort orderRepository;
    private final InventoryReservationPort inventoryReservationPort;
    private final OrderEventPublisherPort orderEventPublisherPort;

    public TransitionSubOrderUseCase(
            OrderRepositoryPort orderRepository,
            InventoryReservationPort inventoryReservationPort,
            OrderEventPublisherPort orderEventPublisherPort
    ) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        this.inventoryReservationPort = Objects.requireNonNull(inventoryReservationPort, "inventoryReservationPort is required");
        this.orderEventPublisherPort = Objects.requireNonNull(orderEventPublisherPort, "orderEventPublisherPort is required");
    }

    // ─── Seller transitions ─────────────────────────────────────────────────────

    /**
     * Seller accepts their sub-order on an order.
     */
    public Order accept(UUID orderId, String sellerId) {
        return transitionSeller(orderId, sellerId, new SubOrderTransition.Accept());
    }

    /**
     * Seller rejects their sub-order and releases the associated inventory reservation.
     */
    public Order reject(UUID orderId, String sellerId) {
        return transitionSeller(orderId, sellerId, new SubOrderTransition.Reject());
    }

    /**
     * Seller ships their sub-order with carrier and tracking information.
     * Audited as SHIP_ORDER on the Order resource.
     */
    @Audited(action = "SHIP_ORDER", resourceType = "Order")
    public Order ship(UUID orderId, String sellerId, String carrier, String trackingNumber) {
        return transitionSeller(orderId, sellerId, new SubOrderTransition.Ship(carrier, trackingNumber));
    }

    // ─── Buyer transitions ─────────────────────────────────────────────────────

    /**
     * Buyer confirms delivery of a specific sub-order.
     */
    public void confirmDelivery(UUID orderId, Long subOrderId, String buyerId) {
        Objects.requireNonNull(orderId, "orderId is required");
        Objects.requireNonNull(subOrderId, "subOrderId is required");
        requireNonBlank(buyerId, "buyerId");

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderAccessDeniedException(
                        "not authorized to confirm delivery for this order"));

        if (!order.buyerId().equals(buyerId)) {
            throw new OrderAccessDeniedException(
                    "not authorized to confirm delivery for this order");
        }

        SubOrder subOrder = order.subOrders().stream()
                .filter(so -> subOrderId.equals(so.id()))
                .findFirst()
                .orElseThrow(() -> new OrderAccessDeniedException(
                        "not authorized to confirm delivery for this order"));

        subOrder.confirmDelivery();
        Order savedOrder = orderRepository.save(order);
        orderEventPublisherPort.publishOrderDelivered(savedOrder, subOrder);
    }

    // ─── Shared transition logic ───────────────────────────────────────────────

    private Order transitionSeller(UUID orderId, String sellerId, SubOrderTransition transition) {
        Objects.requireNonNull(orderId, "orderId is required");
        requireNonBlank(sellerId, "sellerId");

        // Pt40 audit: same fold as the original four use cases. Both "order not
        // found" and "not your sub-order" raise OAD with the same constant
        // message — response body and status are identical regardless of which
        // condition tripped (gotcha #106 oracle prevention).
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderAccessDeniedException(notAuthorizedMessage(transition)));

        SubOrder subOrder = order.subOrders().stream()
                .filter(so -> so.sellerId().equals(sellerId))
                .findFirst()
                .orElseThrow(() -> new OrderAccessDeniedException(notAuthorizedMessage(transition)));

        // REJECT is the only transition that needs the order ID for inventory release.
        if (transition instanceof SubOrderTransition.Reject) {
            subOrder.reject();
            inventoryReservationPort.release(order.id().toString());
        } else {
            applyTransition(subOrder, transition);
        }

        Order savedOrder = orderRepository.save(order);
        orderEventPublisherPort.publishOrderUpdated(savedOrder);
        return savedOrder;
    }

    private void applyTransition(SubOrder subOrder, SubOrderTransition transition) {
        if (transition instanceof SubOrderTransition.Accept) {
            subOrder.accept();
        } else if (transition instanceof SubOrderTransition.Ship s) {
            subOrder.pack();
            subOrder.ship(s.carrier(), s.trackingNumber());
        }
        // Reject is handled in transitionSeller (needs orderId for inventory release).
        // ConfirmDelivery is buyer-only and handled separately.
    }

    private String notAuthorizedMessage(SubOrderTransition transition) {
        if (transition instanceof SubOrderTransition.Accept) {
            return "not authorized to accept this order";
        } else if (transition instanceof SubOrderTransition.Reject) {
            return "not authorized to reject this order";
        } else if (transition instanceof SubOrderTransition.Ship) {
            return "not authorized to ship this order";
        } else {
            return "not authorized to confirm delivery for this order";
        }
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
