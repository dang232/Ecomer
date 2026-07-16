package com.vnshop.orderservice.infrastructure.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.projection.OrderSummaryStatus;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEvent;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEventJpaEntity;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class OrderEventPublisherAdapter implements OrderEventPublisherPort {
    private static final Logger LOGGER = LoggerFactory.getLogger(OrderEventPublisherAdapter.class);
    private static final String AGGREGATE_TYPE = "Order";

    private final OutboxEventRepository repository;
    private final ObjectMapper objectMapper;

    public OrderEventPublisherAdapter(OutboxEventRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void publishOrderCreated(Order order) {
        publish("ORDER_CREATED", order);
    }

    @Override
    public void publishOrderUpdated(Order order) {
        publish("ORDER_UPDATED", order);
    }

    @Override
    public void publishOrderPaid(Order order) {
        publish("ORDER_PAID", order);
    }

    @Override
    public void publishOrderDelivered(Order order, SubOrder subOrder) {
        publish("ORDER_DELIVERED", order, subOrder);
    }

    private void publish(String eventType, Order order) {
        publish(eventType, order, null);
    }

    private void publish(String eventType, Order order, SubOrder subOrder) {
        OrderEvent event = OrderEvent.fromDomain(eventType, order, subOrder);
        String payload = toJson(event);
        OutboxEvent outboxEvent = OutboxEvent.pending(AGGREGATE_TYPE, order.id().toString(), eventType, payload);
        repository.save(OutboxEventJpaEntity.fromDomain(outboxEvent));
        LOGGER.info("Order event {} staged in outbox for order {} buyer {}", eventType, order.id(), order.buyerId());
    }

    private String toJson(OrderEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize order event " + event.orderId(), exception);
        }
    }

    public record OrderEvent(
            String eventType,
            String orderId,
            String orderNumber,
            String buyerId,
            String paymentStatus,
            String fulfillmentStatus,
            java.math.BigDecimal totalAmount,
            int itemCount,
            java.util.List<SellerTotal> sellerTotals,
            java.util.List<OrderEventItem> items
    ) {
        static OrderEvent fromDomain(String eventType, Order order) {
            return fromDomain(eventType, order, null);
        }

        static OrderEvent fromDomain(String eventType, Order order, SubOrder deliveredSubOrder) {
            java.util.List<SubOrder> subOrders = deliveredSubOrder == null
                    ? order.subOrders()
                    : java.util.List.of(deliveredSubOrder);
            return new OrderEvent(
                    eventType,
                    order.id().toString(),
                    order.orderNumber(),
                    order.buyerId(),
                    order.paymentStatus().name(),
                    OrderSummaryStatus.from(order.subOrders().stream()
                            .map(SubOrder::fulfillmentStatus)
                            .toList()),
                    order.finalAmount().amount(),
                    order.subOrders().stream()
                            .flatMap(current -> current.items().stream())
                            .mapToInt(item -> item.quantity())
                            .sum(),
                    subOrders.stream()
                            .map(subOrder -> new SellerTotal(subOrder.sellerId(), subOrder.itemsTotal().amount(), subOrder.commissionTier().name()))
                            .toList(),
                    subOrders.stream()
                            .flatMap(subOrder -> subOrder.items().stream()
                                    .map(item -> new OrderEventItem(item.productId(), item.sellerId(), item.quantity())))
                            .toList()
            );
        }
    }

    public record SellerTotal(String sellerId, java.math.BigDecimal amount, String commissionTier) {
    }

    /**
     * Per-line-item projection embedded in {@code order.created} / {@code order.updated}
     * envelopes. Recommendations-service consumes this to maintain co-purchase counts;
     * existing listeners (finance, projection) ignore unknown fields.
     */
    public record OrderEventItem(String productId, String sellerId, int quantity) {
    }
}
