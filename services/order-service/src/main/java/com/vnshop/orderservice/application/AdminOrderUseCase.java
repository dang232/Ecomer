package com.vnshop.orderservice.application;

import com.vnshop.orderservice.application.coupon.CouponRedemptionService;
import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.projection.OrderSummaryProjection;
import com.vnshop.orderservice.domain.port.out.OrderSummaryQueryPort;
import com.vnshop.orderservice.domain.port.out.UserDirectoryPort;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import org.springframework.transaction.annotation.Transactional;

public class AdminOrderUseCase {

    private final OrderRepositoryPort orderRepository;
    private final OrderSummaryQueryPort orderSummaryQueryPort;
    private final InventoryReservationPort inventoryReservationPort;
    private final OrderEventPublisherPort orderEventPublisherPort;
    private final CouponRedemptionService couponRedemptionService;
    private final UserDirectoryPort userDirectoryPort;

    public AdminOrderUseCase(
            OrderRepositoryPort orderRepository,
            OrderSummaryQueryPort orderSummaryQueryPort,
            InventoryReservationPort inventoryReservationPort,
            OrderEventPublisherPort orderEventPublisherPort,
            CouponRedemptionService couponRedemptionService
    ) {
        this(orderRepository, orderSummaryQueryPort, inventoryReservationPort, orderEventPublisherPort,
                couponRedemptionService, (buyerIds, sellerIds) -> UserDirectoryPort.DirectorySnapshot.empty());
    }

    public AdminOrderUseCase(
            OrderRepositoryPort orderRepository,
            OrderSummaryQueryPort orderSummaryQueryPort,
            InventoryReservationPort inventoryReservationPort,
            OrderEventPublisherPort orderEventPublisherPort,
            CouponRedemptionService couponRedemptionService,
            UserDirectoryPort userDirectoryPort
    ) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        this.orderSummaryQueryPort = Objects.requireNonNull(orderSummaryQueryPort, "orderSummaryQueryPort is required");
        this.inventoryReservationPort = Objects.requireNonNull(inventoryReservationPort, "inventoryReservationPort is required");
        this.orderEventPublisherPort = Objects.requireNonNull(orderEventPublisherPort, "orderEventPublisherPort is required");
        this.couponRedemptionService = Objects.requireNonNull(couponRedemptionService, "couponRedemptionService is required");
        this.userDirectoryPort = Objects.requireNonNull(userDirectoryPort, "userDirectoryPort is required");
    }

    /**
     * Returns a flat list of all order summaries, optionally filtered by a
     * fulfillment status string. Used by the admin order management panel.
     */
    public Page<OrderSummaryProjection> listAllOrders(String query, String status, Pageable pageable) {
        Page<OrderSummaryProjection> page = orderSummaryQueryPort.findAll(query, status, pageable);
        if (page.isEmpty()) {
            return page;
        }
        var buyerIds = page.getContent().stream()
                .map(OrderSummaryProjection::buyerId)
                .filter(Objects::nonNull)
                .filter(id -> !id.isBlank())
                .collect(java.util.stream.Collectors.toSet());
        var sellerIds = page.getContent().stream()
                .map(OrderSummaryProjection::sellerId)
                .filter(Objects::nonNull)
                .filter(id -> !id.isBlank())
                .collect(java.util.stream.Collectors.toSet());
        UserDirectoryPort.DirectorySnapshot names = userDirectoryPort.lookup(buyerIds, sellerIds);
        return page.map(summary -> summary.withDisplayNames(
                names.buyerNames().get(summary.buyerId()),
                names.sellerNames().get(summary.sellerId())));
    }

    public List<OrderSummaryProjection> listAllOrdersCursor(String query, String status, Instant createdAtBefore,
            String orderIdBefore, int limitPlusOne) {
        List<OrderSummaryProjection> rows = orderSummaryQueryPort.findAllCursor(
                query, status, createdAtBefore, orderIdBefore, limitPlusOne);
        if (rows.isEmpty()) {
            return rows;
        }
        var buyerIds = rows.stream().limit(limitPlusOne)
                .map(OrderSummaryProjection::buyerId).filter(Objects::nonNull).filter(id -> !id.isBlank())
                .collect(java.util.stream.Collectors.toSet());
        var sellerIds = rows.stream().limit(limitPlusOne)
                .map(OrderSummaryProjection::sellerId).filter(Objects::nonNull).filter(id -> !id.isBlank())
                .collect(java.util.stream.Collectors.toSet());
        UserDirectoryPort.DirectorySnapshot names = userDirectoryPort.lookup(buyerIds, sellerIds);
        return rows.stream().map(summary -> summary.withDisplayNames(
                names.buyerNames().get(summary.buyerId()), names.sellerNames().get(summary.sellerId()))).toList();
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
        boolean cancelledAny = false;
        for (SubOrder subOrder : order.subOrders()) {
            FulfillmentStatus fs = subOrder.fulfillmentStatus();
            if (fs == FulfillmentStatus.PENDING_ACCEPTANCE || fs == FulfillmentStatus.ACCEPTED) {
                subOrder.cancel();
                cancelledAny = true;
            }
        }
        if (cancelledAny) {
            inventoryReservationPort.release(order.id().toString());
            releaseCouponForFullyCancelledOrder(order);
            order.markPaymentFailed();
        }
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
        boolean cancelledAny = false;
        for (SubOrder subOrder : order.subOrders()) {
            FulfillmentStatus before = subOrder.fulfillmentStatus();
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
            cancelledAny |= target == FulfillmentStatus.CANCELLED
                    && before != subOrder.fulfillmentStatus();
        }
        if (cancelledAny) {
            releaseCouponForFullyCancelledOrder(order);
        }
        Order saved = orderRepository.save(order);
        orderEventPublisherPort.publishOrderUpdated(saved);
        return saved;
    }

    private void releaseCouponForFullyCancelledOrder(Order order) {
        boolean fullyCancelled = order.subOrders().stream()
                .allMatch(subOrder -> subOrder.fulfillmentStatus() == FulfillmentStatus.CANCELLED
                        || subOrder.fulfillmentStatus() == FulfillmentStatus.REJECTED);
        if (fullyCancelled) {
            couponRedemptionService.release(order.id());
        }
    }
}
