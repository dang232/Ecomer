package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;

import java.util.Objects;

/**
 * Buyer-scoped reconciliation lookup for an ambiguous checkout response.
 *
 * <p>This path deliberately only reads the existing order row. It must never
 * invoke checkout because callers use it after a timeout, when resubmitting
 * could create a second order.
 */
public class FindOrderByIdempotencyKeyUseCase {
    static final int MAX_IDEMPOTENCY_KEY_LENGTH = 255;

    private final OrderRepositoryPort orderRepository;

    public FindOrderByIdempotencyKeyUseCase(OrderRepositoryPort orderRepository) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
    }

    public Order findForBuyer(String idempotencyKey, String buyerId) {
        requireKey(idempotencyKey);
        Objects.requireNonNull(buyerId, "buyerId is required");

        return orderRepository.findByIdempotencyKey(idempotencyKey)
                .filter(order -> buyerId.equals(order.buyerId()))
                .orElseThrow(OrderByIdempotencyKeyNotFoundException::new);
    }

    private static void requireKey(String key) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("idempotencyKey is required");
        }
        if (key.length() > MAX_IDEMPOTENCY_KEY_LENGTH) {
            throw new IllegalArgumentException("idempotencyKey is too long");
        }
    }

    /** Keeps unknown keys and another buyer's key indistinguishable at the API boundary. */
    public static final class OrderByIdempotencyKeyNotFoundException extends RuntimeException {
        public OrderByIdempotencyKeyNotFoundException() {
            super("order not found");
        }
    }
}
