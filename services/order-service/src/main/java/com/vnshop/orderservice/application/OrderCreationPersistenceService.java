package com.vnshop.orderservice.application;

import com.vnshop.orderservice.application.finance.AllocateOrderFinancialsUseCase;
import com.vnshop.orderservice.application.saga.SagaOrchestrator;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public class OrderCreationPersistenceService {
    private final OrderRepositoryPort orderRepository;
    private final OrderEventPublisherPort events;
    private final SagaOrchestrator saga;
    private final AllocateOrderFinancialsUseCase allocation;

    public OrderCreationPersistenceService(OrderRepositoryPort orderRepository,
            OrderEventPublisherPort events, SagaOrchestrator saga,
            AllocateOrderFinancialsUseCase allocation) {
        this.orderRepository = Objects.requireNonNull(orderRepository, "orderRepository is required");
        this.events = Objects.requireNonNull(events, "events is required");
        this.saga = Objects.requireNonNull(saga, "saga is required");
        this.allocation = Objects.requireNonNull(allocation, "allocation is required");
    }

    @Transactional
    public PersistedOrder persist(Order order) {
        orderRepository.lockIdempotencyKey(order.idempotencyKey());
        var existing = orderRepository.findByIdempotencyKey(order.idempotencyKey());
        if (existing.isPresent()) {
            if (!order.buyerId().equals(existing.get().buyerId())) {
                throw new OrderAccessDeniedException("not authorized for this order");
            }
            return new PersistedOrder(existing.get(), null, List.of());
        }
        String sagaId = UUID.randomUUID().toString();
        saga.start(sagaId, order.id().toString());
        Order saved = orderRepository.save(order);
        List<SubOrderFinancialAllocation> allocations = allocation.allocate(saved);
        events.publishOrderCreated(saved);
        return new PersistedOrder(saved, sagaId, allocations);
    }

    @Transactional
    public void finalizeOrder(Order order, String sagaId) {
        saga.complete(sagaId);
    }

    public record PersistedOrder(Order order, String sagaId, List<SubOrderFinancialAllocation> allocations) {
    }
}
