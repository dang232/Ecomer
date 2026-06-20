package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Shared in-memory fakes for order-service application tests.
 *
 * <p>Package-private and test-scope only — never imported by production code.
 */
public final class TestFakes {
    private TestFakes() {}

    // ─── Order event publishers ───────────────────────────────────────────────

    /** Records publishOrderUpdated calls. Use for Accept/Reject/Ship/ConfirmDelivery tests. */
    public static final class RecordingOrderEvents implements OrderEventPublisherPort {
        public final List<Order> updates = new ArrayList<>();
        @Override public void publishOrderCreated(Order order) {}
        @Override public void publishOrderUpdated(Order order) { updates.add(order); }
        @Override public void publishOrderPaid(Order order) {}
        @Override public void publishOrderDelivered(Order order, SubOrder subOrder) {}
    }

    /** Records publishOrderPaid calls. Use for PaymentCompletedListener tests. */
    public static final class RecordingPublisher implements OrderEventPublisherPort {
        public final List<Order> paid = new ArrayList<>();
        @Override public void publishOrderCreated(Order order) {}
        @Override public void publishOrderUpdated(Order order) {}
        @Override public void publishOrderPaid(Order order) { paid.add(order); }
        @Override public void publishOrderDelivered(Order order, SubOrder subOrder) {}
    }

    /** No-op publisher for tests that don't assert on events. */
    public static final class NoopOrderEvents implements OrderEventPublisherPort {
        @Override public void publishOrderCreated(Order order) {}
        @Override public void publishOrderUpdated(Order order) {}
        @Override public void publishOrderPaid(Order order) {}
        @Override public void publishOrderDelivered(Order order, SubOrder subOrder) {}
    }

    // ─── Repositories ─────────────────────────────────────────────────────────

    public static final class FakeOrderRepository implements OrderRepositoryPort {
        private final Map<UUID, Order> orders = new HashMap<>();

        @Override
        public Order save(Order order) {
            orders.put(order.id(), order);
            return order;
        }

        @Override
        public Optional<Order> findById(UUID orderId) {
            return Optional.ofNullable(orders.get(orderId));
        }

        @Override public Optional<Order> findByOrderNumber(String orderNumber) { return Optional.empty(); }
        @Override public Optional<Order> findByIdempotencyKey(String idempotencyKey) { return Optional.empty(); }
        @Override public List<Order> findByBuyerId(String buyerId) { return List.of(); }
        @Override public Optional<Order> findBySubOrderId(Long subOrderId) { return Optional.empty(); }
        @Override public Optional<String> findOrderIdBySubOrderId(Long subOrderId) { return Optional.empty(); }
        @Override public List<Order> findBySellerIdAndFulfillmentStatus(String sellerId, FulfillmentStatus status) { return List.of(); }
    }

    public static final class FakeReturnRepository implements ReturnRepositoryPort {
        private final Map<UUID, Return> returns = new HashMap<>();

        @Override
        public Return save(Return r) {
            returns.put(r.returnId(), r);
            return r;
        }

        @Override
        public Optional<Return> findById(UUID returnId) {
            return Optional.ofNullable(returns.get(returnId));
        }

        @Override
        public List<Return> findByBuyerId(String buyerId) {
            return List.of();
        }

        @Override
        public Optional<Return> findBySubOrderId(Long subOrderId) {
            return Optional.empty();
        }
    }
}
