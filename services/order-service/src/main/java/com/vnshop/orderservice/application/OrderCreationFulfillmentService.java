package com.vnshop.orderservice.application;

import com.vnshop.orderservice.application.finance.AllocateOrderFinancialsUseCase;
import com.vnshop.orderservice.application.saga.SagaOrchestrator;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.MetricsPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.orderservice.domain.port.out.ShippingRequestPort;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.infrastructure.grpc.PaymentException;
import com.vnshop.orderservice.infrastructure.shipping.ShippingException;

import java.util.List;
import java.util.Map;
import io.github.resilience4j.bulkhead.Bulkhead;
import io.github.resilience4j.bulkhead.BulkheadConfig;
import io.github.resilience4j.bulkhead.BulkheadFullException;

final class OrderCreationFulfillmentService {
    private final OrderCreationPersistenceService persistence;
    private final InventoryReservationPort inventory;
    private final PaymentRequestPort payment;
    private final ShippingRequestPort shipping;
    private final MetricsPort metrics;
    private final SagaOrchestrator saga;
    private final Bulkhead inventoryBulkhead;
    private final Bulkhead paymentBulkhead;
    private final Bulkhead shippingBulkhead;

    OrderCreationFulfillmentService(OrderCreationPersistenceService persistence, InventoryReservationPort inventory,
            PaymentRequestPort payment, ShippingRequestPort shipping, OrderEventPublisherPort events,
            MetricsPort metrics, SagaOrchestrator saga, AllocateOrderFinancialsUseCase allocation) {
        this(persistence, inventory, payment, shipping, events, metrics, saga, allocation,
                defaultBulkhead("inventory"), defaultBulkhead("payment"), defaultBulkhead("shipping"));
    }

    OrderCreationFulfillmentService(OrderCreationPersistenceService persistence, InventoryReservationPort inventory,
            PaymentRequestPort payment, ShippingRequestPort shipping, OrderEventPublisherPort events,
            MetricsPort metrics, SagaOrchestrator saga, AllocateOrderFinancialsUseCase allocation,
            Bulkhead inventoryBulkhead, Bulkhead paymentBulkhead, Bulkhead shippingBulkhead) {
        this.persistence = persistence;
        this.inventory = inventory;
        this.payment = payment;
        this.shipping = shipping;
        this.metrics = metrics;
        this.saga = saga;
        this.inventoryBulkhead = inventoryBulkhead;
        this.paymentBulkhead = paymentBulkhead;
        this.shippingBulkhead = shippingBulkhead;
    }

    Order execute(OrderDraftFactory.OrderDraft draft) {
        var timer = metrics.startTimer();
        Order order = draft.order();
        OrderCreationPersistenceService.PersistedOrder persisted = persistence.persist(order);
        Order saved = persisted.order();
        String sagaId = persisted.sagaId();
        if (sagaId == null) {
            return saved;
        }
        String lastSuccessfulStep = null;
        try {
            withBulkhead(inventoryBulkhead, () -> inventory.reserve(order.id().toString(), draft.itemSnapshot()));
            lastSuccessfulStep = "INVENTORY";
            saga.stepCompleted(sagaId, lastSuccessfulStep);
            withBulkhead(paymentBulkhead, () -> payment.requestPayment(
                    order.id().toString(), order.buyerId(), order.paymentMethod(), order.finalAmount()));
            Map<Long, com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation> bySubOrder = persisted.allocations()
                    .stream().collect(java.util.stream.Collectors.toMap(
                            com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation::subOrderId,
                            value -> value));
            lastSuccessfulStep = "PAYMENT";
            saga.stepCompleted(sagaId, lastSuccessfulStep);
            for (var subOrder : saved.subOrders()) {
                var current = bySubOrder.get(subOrder.id());
                if (current == null) {
                    throw new IllegalStateException("financial allocation missing for sub-order " + subOrder.id());
                }
                Money cod = "COD".equalsIgnoreCase(saved.paymentMethod())
                        ? new Money(current.components().buyerPaidAmount()) : Money.ZERO;
                withBulkhead(shippingBulkhead, () -> shipping.requestShipping(saved.id().toString(), subOrder,
                        draft.shippingAddress(), draft.shippingDetails(), cod,
                        new Money(current.components().itemGmvAmount())));
                lastSuccessfulStep = "SHIPPING";
                saga.stepCompleted(sagaId, lastSuccessfulStep);
            }
            persistence.finalizeOrder(saved, sagaId);
            metrics.recordOrderCreated();
            metrics.stopTimer(timer);
            return saved;
        } catch (IllegalArgumentException | IllegalStateException | PaymentException | ShippingException failure) {
            metrics.recordOrderCreationFailed();
            metrics.stopTimer(timer);
            saga.compensate(sagaId, failedStep(sagaId, lastSuccessfulStep));
            throw failure;
        }
    }

    private static void withBulkhead(Bulkhead bulkhead, Runnable operation) {
        try {
            bulkhead.executeRunnable(operation);
        } catch (BulkheadFullException exception) {
            throw new IllegalStateException("provider bulkhead is full: " + bulkhead.getName(), exception);
        }
    }

    private static Bulkhead defaultBulkhead(String name) {
        return Bulkhead.of(name, BulkheadConfig.custom()
                .maxConcurrentCalls(32)
                .maxWaitDuration(java.time.Duration.ZERO)
                .build());
    }

    private String failedStep(String sagaId, String lastSuccessfulStep) {
        return saga.getLastCompletedStep(sagaId).or(() -> java.util.Optional.ofNullable(lastSuccessfulStep)).map(step -> switch (step) {
            case "INVENTORY" -> "PAYMENT";
            case "PAYMENT", "SHIPPING" -> "SHIPPING";
            default -> "INVENTORY";
        }).orElse("INVENTORY");
    }
}
