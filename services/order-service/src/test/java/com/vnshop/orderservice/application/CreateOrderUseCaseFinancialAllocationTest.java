package com.vnshop.orderservice.application;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.orderservice.application.finance.AllocateOrderFinancialsUseCase;
import com.vnshop.orderservice.application.saga.SagaOrchestrator;
import com.vnshop.orderservice.application.tax.TaxCalculationService;
import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.CommissionTier;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.CartRepositoryPort;
import com.vnshop.orderservice.domain.port.out.CommissionTierLookupPort;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.MetricsPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.OutboxPort;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.orderservice.domain.port.out.SagaCompensationPublisherPort;
import com.vnshop.orderservice.domain.port.out.SagaStateRepository;
import com.vnshop.orderservice.domain.port.out.ShippingRequestPort;
import com.vnshop.orderservice.domain.port.out.SubOrderFinancialAllocationRepositoryPort;
import com.vnshop.orderservice.domain.finance.FinancialComponents;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.domain.saga.SagaState;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class CreateOrderUseCaseFinancialAllocationTest {

    @Test
    void requiresFinancialAllocationDependency() {
        assertThatThrownBy(() -> new CreateOrderUseCase(mock(OrderRepositoryPort.class),
                mock(InventoryReservationPort.class), mock(PaymentRequestPort.class), mock(ShippingRequestPort.class),
                mock(OrderEventPublisherPort.class), standardTierLookup(), mock(CartRepositoryPort.class),
                mock(MetricsPort.class), saga(), new TaxCalculationService((code, date) -> Optional.of(BigDecimal.ZERO)),
                null, null))
                .isInstanceOf(NullPointerException.class)
                .hasMessage("allocateOrderFinancialsUseCase is required");
    }

    @Test
    void persistsAllocationsAfterOrderSaveAndBeforeOrderPublication() {
        OrderRepositoryPort orders = mock(OrderRepositoryPort.class);
        when(orders.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(orders.save(any())).thenAnswer(invocation -> withGeneratedSubOrderIds(invocation.getArgument(0)));
        SubOrderFinancialAllocationRepositoryPort allocations = mock(SubOrderFinancialAllocationRepositoryPort.class);
        OrderEventPublisherPort events = mock(OrderEventPublisherPort.class);
        CreateOrderUseCase useCase = new CreateOrderUseCase(orders,
                mock(InventoryReservationPort.class), mock(PaymentRequestPort.class), mock(ShippingRequestPort.class),
                events, standardTierLookup(), mock(CartRepositoryPort.class), mock(MetricsPort.class), saga(),
                new TaxCalculationService((code, date) -> Optional.of(BigDecimal.ZERO)), null,
                new AllocateOrderFinancialsUseCase(allocations));

        useCase.create(new CreateOrderCommand("buyer", new Address("street", null, "district", "city"),
                List.of(new OrderItem("product", "sku", "seller", "Product", 1,
                        new Money(new BigDecimal("100000")), null)), "idempotency-" + UUID.randomUUID()));

        InOrder ordering = inOrder(orders, allocations, events);
        ordering.verify(orders).save(any(Order.class));
        ordering.verify(allocations).saveAll(any());
        ordering.verify(events).publishOrderCreated(any(Order.class));
    }

    @Test
    void requestsShippingFromPersistedFinancialAllocation() {
        OrderRepositoryPort orders = mock(OrderRepositoryPort.class);
        when(orders.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(orders.save(any())).thenAnswer(invocation -> withGeneratedSubOrderIds(invocation.getArgument(0)));
        SubOrderFinancialAllocationRepositoryPort allocationRepository = mock(SubOrderFinancialAllocationRepositoryPort.class);
        ShippingRequestPort shipping = mock(ShippingRequestPort.class);
        AllocateOrderFinancialsUseCase allocationUseCase = new AllocateOrderFinancialsUseCase(allocationRepository);
        CreateOrderUseCase useCase = new CreateOrderUseCase(orders,
                mock(InventoryReservationPort.class), mock(PaymentRequestPort.class), shipping,
                mock(OrderEventPublisherPort.class), standardTierLookup(), mock(CartRepositoryPort.class),
                mock(MetricsPort.class), saga(), new TaxCalculationService((code, date) -> Optional.of(BigDecimal.ZERO)),
                null, allocationUseCase);

        useCase.create(new CreateOrderCommand("buyer", new Address("street", null, "district", "city"),
                List.of(new OrderItem("product", "sku", "seller", "Product", 1,
                        new Money(new BigDecimal("100000")), null)), "idempotency-" + UUID.randomUUID()));

        var invocation = org.mockito.Mockito.mockingDetails(shipping).getInvocations().stream().findFirst().orElseThrow();
        var arguments = invocation.getArguments();
        org.assertj.core.api.Assertions.assertThat(arguments[4]).isEqualTo(new Money(new BigDecimal("100000")));
        org.assertj.core.api.Assertions.assertThat(arguments[5]).isEqualTo(new Money(new BigDecimal("100000")));
    }

    private static Order withGeneratedSubOrderIds(Order order) {
        List<SubOrder> persistedSubOrders = order.subOrders().stream().map(subOrder -> new SubOrder(1L,
                subOrder.sellerId(), subOrder.items(), subOrder.fulfillmentStatus(), subOrder.shippingInfo(),
                subOrder.commissionTier())).toList();
        return new Order(order.id(), order.orderNumber(), order.buyerId(), order.shippingAddress(), persistedSubOrders,
                order.itemsTotal(), order.shippingTotal(), order.discount(), order.taxTotal(), order.paymentMethod(),
                order.paymentStatus(), order.idempotencyKey());
    }

    private static CommissionTierLookupPort standardTierLookup() {
        return new CommissionTierLookupPort() {
            @Override public CommissionTier findBySellerId(String sellerId) { return CommissionTier.STANDARD; }
            @Override public java.util.Map<String, CommissionTier> findBySellerIds(java.util.Set<String> sellerIds) {
                return sellerIds.stream().collect(java.util.stream.Collectors.toMap(id -> id, id -> CommissionTier.STANDARD));
            }
        };
    }

    private static SagaOrchestrator saga() {
        SagaStateRepository states = new SagaStateRepository() {
            @Override public SagaState save(SagaState state) { return state; }
            @Override public Optional<SagaState> findBySagaId(String sagaId) { return Optional.empty(); }
            @Override public Optional<SagaState> findByOrderId(String orderId) { return Optional.empty(); }
            @Override public List<SagaState> findCompensatingUpdatedBefore(java.time.Instant cutoff) { return List.of(); }
        };
        return new SagaOrchestrator(states, new OutboxPort() {
            @Override public void publish(String aggregateType, String aggregateId, String eventType, String payload) { }
        }, new SagaCompensationPublisherPort() {
            @Override public void publishInventoryReleaseRequested(String orderId, String sagaId) { }
            @Override public void publishPaymentRefundRequested(String orderId, String sagaId) { }
            @Override public void publishShippingCancellationRequested(String orderId, String sagaId, String reason) { }
        }, 1_000);
    }
}
