package com.vnshop.orderservice.domain.port.out;

import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Order;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepositoryPort {
    default void lockIdempotencyKey(String idempotencyKey) {
        // Production adapters override with a transaction-scoped database lock.
    }

    Order save(Order order);

    Optional<Order> findById(UUID orderId);

    Optional<Order> findByOrderNumber(String orderNumber);

    Optional<Order> findByIdempotencyKey(String idempotencyKey);

    List<Order> findByBuyerId(String buyerId);

    Optional<Order> findBySubOrderId(Long subOrderId);

    Optional<String> findOrderIdBySubOrderId(Long subOrderId);

    List<Order> findBySellerIdAndFulfillmentStatus(String sellerId, FulfillmentStatus status);

    /**
     * Multi-status variant of {@link #findBySellerIdAndFulfillmentStatus}. Used
     * by the seller console's "Orders" tab so a single fetch returns every
     * actionable row regardless of which fulfillment step it sits at
     * (PENDING_ACCEPTANCE for accept/reject, ACCEPTED for ship).
     *
     * <p>Default falls back to {@link #findBySellerIdAndFulfillmentStatus}
     * across each status — correct but N queries; the JPA adapter overrides
     * with a single {@code IN}-clause query.</p>
     */
    default List<Order> findBySellerIdAndFulfillmentStatusIn(String sellerId, List<FulfillmentStatus> statuses) {
        return statuses.stream()
                .flatMap(s -> findBySellerIdAndFulfillmentStatus(sellerId, s).stream())
                .toList();
    }

    default List<Order> findBySellerIdAndFulfillmentStatusIn(
            String sellerId, List<FulfillmentStatus> statuses, String query) {
        return findBySellerIdAndFulfillmentStatusIn(sellerId, statuses);
    }
}
