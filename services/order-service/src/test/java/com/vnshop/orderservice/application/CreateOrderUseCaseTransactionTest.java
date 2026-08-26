package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vnshop.orderservice.application.finance.AllocateOrderFinancialsUseCase;
import com.vnshop.orderservice.application.saga.SagaOrchestrator;
import com.vnshop.orderservice.application.tax.TaxCalculationService;
import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.CommissionTier;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentStatus;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.finance.FinancialComponents;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.domain.port.out.CartRepositoryPort;
import com.vnshop.orderservice.domain.port.out.CommissionTierLookupPort;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.MetricsPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.orderservice.domain.port.out.ShippingRequestPort;
import io.github.resilience4j.bulkhead.Bulkhead;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class CreateOrderUseCaseTransactionTest {
    @Test
    void createDoesNotHoldTransactionAcrossProviderFulfillment() throws Exception {
        Method create = CreateOrderUseCase.class.getMethod("create", CreateOrderCommand.class);
        Method persist = OrderCreationPersistenceService.class.getMethod("persist", com.vnshop.orderservice.domain.Order.class);

        assertThat(create.isAnnotationPresent(Transactional.class)).isFalse();
        assertThat(persist.isAnnotationPresent(Transactional.class)).isTrue();
    }

    @Test
    void providerCallsRunOutsideTransaction() {
        OrderRepositoryPort orders = mock(OrderRepositoryPort.class);
        InventoryReservationPort inventory = mock(InventoryReservationPort.class);
        PaymentRequestPort payment = mock(PaymentRequestPort.class);
        ShippingRequestPort shipping = mock(ShippingRequestPort.class);
        OrderEventPublisherPort events = mock(OrderEventPublisherPort.class);
        AllocateOrderFinancialsUseCase allocation = mock(AllocateOrderFinancialsUseCase.class);
        CreateOrderUseCase useCase = useCase(orders, inventory, payment, shipping, events, allocation);

        when(orders.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(orders.save(any(Order.class))).thenAnswer(invocation -> withSubOrderId(invocation.getArgument(0)));
        when(allocation.allocate(any(Order.class))).thenAnswer(invocation -> List.of(allocation(invocation.getArgument(0))));
        doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return null;
        }).when(inventory).reserve(anyString(), anyList());
        doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return null;
        }).when(payment).requestPayment(anyString(), anyString(), anyString(), any(Money.class));

        useCase.create(command("provider-boundary"));

        InOrder order = inOrder(orders, events, inventory, payment);
        order.verify(orders).save(any(Order.class));
        order.verify(events).publishOrderCreated(any(Order.class));
        order.verify(inventory).reserve(anyString(), anyList());
        order.verify(payment).requestPayment(anyString(), anyString(), anyString(), any(Money.class));
    }

    @Test
    void providerTimeoutKeepsPending() {
        OrderRepositoryPort orders = mock(OrderRepositoryPort.class);
        InventoryReservationPort inventory = mock(InventoryReservationPort.class);
        PaymentRequestPort payment = mock(PaymentRequestPort.class);
        ShippingRequestPort shipping = mock(ShippingRequestPort.class);
        OrderEventPublisherPort events = mock(OrderEventPublisherPort.class);
        AllocateOrderFinancialsUseCase allocation = mock(AllocateOrderFinancialsUseCase.class);
        CreateOrderUseCase useCase = useCase(orders, inventory, payment, shipping, events, allocation);

        when(orders.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(orders.save(any(Order.class))).thenAnswer(invocation -> withSubOrderId(invocation.getArgument(0)));
        when(allocation.allocate(any(Order.class))).thenAnswer(invocation -> List.of(allocation(invocation.getArgument(0))));
        doThrow(new IllegalStateException("payment provider timeout"))
                .when(payment).requestPayment(anyString(), anyString(), anyString(), any(Money.class));

        assertThatThrownBy(() -> useCase.create(command("provider-timeout")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("payment provider timeout");

        org.mockito.ArgumentCaptor<Order> savedOrder = org.mockito.ArgumentCaptor.forClass(Order.class);
        org.mockito.Mockito.verify(orders).save(savedOrder.capture());
        assertThat(savedOrder.getValue().paymentStatus()).isEqualTo(PaymentStatus.PENDING);
    }

    private static CreateOrderUseCase useCase(OrderRepositoryPort orders,
            InventoryReservationPort inventory, PaymentRequestPort payment, ShippingRequestPort shipping,
            OrderEventPublisherPort events, AllocateOrderFinancialsUseCase allocation) {
        MetricsPort metrics = mock(MetricsPort.class);
        when(metrics.startTimer()).thenReturn(new Object());
        SagaOrchestrator saga = mock(SagaOrchestrator.class);
        OrderCreationPersistenceService persistence = new OrderCreationPersistenceService(orders, events, saga, allocation);
        CommissionTierLookupPort tiers = new CommissionTierLookupPort() {
            @Override public CommissionTier findBySellerId(String sellerId) { return CommissionTier.STANDARD; }
            @Override public Map<String, CommissionTier> findBySellerIds(java.util.Set<String> sellerIds) {
                return sellerIds.stream().collect(java.util.stream.Collectors.toMap(id -> id, id -> CommissionTier.STANDARD));
            }
        };
        return new CreateOrderUseCase(orders, inventory, payment, shipping, events, tiers,
                mock(CartRepositoryPort.class), metrics, saga,
                new TaxCalculationService((code, date) -> Optional.of(BigDecimal.ZERO)), null, allocation,
                persistence, Bulkhead.ofDefaults("inventory-test"), Bulkhead.ofDefaults("payment-test"),
                Bulkhead.ofDefaults("shipping-test"));
    }

    private static CreateOrderCommand command(String idempotencyKey) {
        return new CreateOrderCommand("buyer", new Address("street", "ward", "district", "city"),
                List.of(new OrderItem("product", "sku", "seller", "Product", 1,
                        new Money(new BigDecimal("100")), null)), idempotencyKey);
    }

    private static Order withSubOrderId(Order order) {
        List<SubOrder> subOrders = order.subOrders().stream()
                .map(subOrder -> new SubOrder(1L, subOrder.sellerId(), subOrder.items(),
                        subOrder.fulfillmentStatus(), subOrder.shippingInfo(), subOrder.commissionTier(), subOrder.parcel()))
                .toList();
        return new Order(order.id(), order.orderNumber(), order.buyerId(), order.shippingAddress(), subOrders,
                order.itemsTotal(), order.shippingTotal(), order.discount(), order.taxTotal(), order.paymentMethod(),
                order.paymentStatus(), order.idempotencyKey());
    }

    private static SubOrderFinancialAllocation allocation(Order order) {
        return new SubOrderFinancialAllocation(UUID.randomUUID(), 1, order.id(), 1L, "seller",
                CommissionTier.STANDARD, new BigDecimal("0.10"),
                new FinancialComponents(new BigDecimal("100"), BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                        new BigDecimal("100"), new BigDecimal("10"), new BigDecimal("90"),
                        new BigDecimal("100"), "VND"),
                SubOrderFinancialAllocation.Source.NATIVE_V1, Instant.now());
    }
}
