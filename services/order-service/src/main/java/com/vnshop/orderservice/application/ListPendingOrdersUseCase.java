package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;

import java.util.List;

public class ListPendingOrdersUseCase {

    /**
     * Statuses the seller console's "Orders" tab needs to act on. The label
     * "pending" is historical — the queue is really "actionable orders":
     * <ul>
     *   <li>{@link FulfillmentStatus#PENDING_ACCEPTANCE} — accept / reject</li>
     *   <li>{@link FulfillmentStatus#ACCEPTED} — ship</li>
     * </ul>
     * Excluding ACCEPTED here would hide the order from the seller after
     * accept and there's no other UI surface to reach it from — caught by
     * AC-3.2 of the BA-grade journey suite.
     */
    private static final List<FulfillmentStatus> ACTIONABLE = List.of(
            FulfillmentStatus.PENDING_ACCEPTANCE,
            FulfillmentStatus.ACCEPTED
    );

    private final OrderRepositoryPort orderRepositoryPort;

    public ListPendingOrdersUseCase(OrderRepositoryPort orderRepositoryPort) {
        this.orderRepositoryPort = orderRepositoryPort;
    }

    public List<Order> listPendingBySeller(String sellerId) {
        return listPendingBySeller(sellerId, null);
    }

    public List<Order> listPendingBySeller(String sellerId, String query) {
        return orderRepositoryPort.findBySellerIdAndFulfillmentStatusIn(sellerId, ACTIONABLE, query);
    }

    public String orderIdFromSubOrderId(Long subOrderId) {
        return orderRepositoryPort.findOrderIdBySubOrderId(subOrderId)
                .orElseThrow(() -> new IllegalArgumentException("subOrder not found: " + subOrderId));
    }
}
