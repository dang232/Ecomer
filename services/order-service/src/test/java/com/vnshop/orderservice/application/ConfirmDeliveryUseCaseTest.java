package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentStatus;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.SellerFinanceAdjustmentPublisherPort;
import com.vnshop.orderservice.domain.port.out.SubOrderFinancialAllocationRepositoryPort;
import com.vnshop.orderservice.infrastructure.event.finance.SellerFinanceAdjustmentPublisherAdapterTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

class ConfirmDeliveryUseCaseTest {

    @Test
    void publishesBuyerConfirmedReleaseFromTheAllocationSnapshot() {
        UUID orderId = UUID.randomUUID();
        SubOrder subOrder = new SubOrder(17L, "seller-42", List.of(new OrderItem("product-1", "sku", "seller-42",
                "Product", 1, new Money(new BigDecimal("100000")), null)), FulfillmentStatus.SHIPPED,
                Money.ZERO, "STANDARD", "GHN", "tracking");
        Order order = new Order(orderId, "VNS-20260724-0001", "buyer-1", new Address("street", null, "district", "city"),
                List.of(subOrder), new Money(new BigDecimal("100000")), Money.ZERO, Money.ZERO, "VIETQR",
                PaymentStatus.COMPLETED, "checkout-key");
        OrderRepositoryPort orders = mock(OrderRepositoryPort.class);
        SubOrderFinancialAllocationRepositoryPort allocations = mock(SubOrderFinancialAllocationRepositoryPort.class);
        SellerFinanceAdjustmentPublisherPort finance = mock(SellerFinanceAdjustmentPublisherPort.class);
        when(orders.findById(orderId)).thenReturn(Optional.of(order));
        when(orders.save(order)).thenReturn(order);
        var allocation = SellerFinanceAdjustmentPublisherAdapterTest.allocation();
        when(allocations.findByOrderId(orderId)).thenReturn(List.of(allocation));

        new ConfirmDeliveryUseCase(orders, mock(OrderEventPublisherPort.class), allocations, finance, true)
                .confirm(orderId, 17L, "buyer-1");

        verify(finance).publishRelease(allocation, "buyer-1");
        assertThat(subOrder.fulfillmentStatus()).isEqualTo(FulfillmentStatus.DELIVERED);
    }

    @Test
    void refusesToReleaseAnUnpaidNonCodOrder() {
        UUID orderId = UUID.randomUUID();
        SubOrder subOrder = new SubOrder(17L, "seller-42", List.of(new OrderItem("product-1", "sku", "seller-42",
                "Product", 1, new Money(new BigDecimal("100000")), null)), FulfillmentStatus.SHIPPED,
                Money.ZERO, "STANDARD", "GHN", "tracking");
        Order order = new Order(orderId, "VNS-20260724-0002", "buyer-1", new Address("street", null, "district", "city"),
                List.of(subOrder), new Money(new BigDecimal("100000")), Money.ZERO, Money.ZERO, "VIETQR",
                PaymentStatus.PENDING, "checkout-key");
        OrderRepositoryPort orders = mock(OrderRepositoryPort.class);
        when(orders.findById(orderId)).thenReturn(Optional.of(order));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> new ConfirmDeliveryUseCase(
                        orders, mock(OrderEventPublisherPort.class), mock(SubOrderFinancialAllocationRepositoryPort.class),
                        mock(SellerFinanceAdjustmentPublisherPort.class), true)
                .confirm(orderId, 17L, "buyer-1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("completed payment");
        org.mockito.Mockito.verify(orders, org.mockito.Mockito.never()).save(order);
        assertThat(subOrder.fulfillmentStatus()).isEqualTo(FulfillmentStatus.SHIPPED);
    }

    @Test
    void collectsCodPaymentWhenBuyerConfirmsDelivery() {
        UUID orderId = UUID.randomUUID();
        SubOrder subOrder = new SubOrder(17L, "seller-42", List.of(new OrderItem("product-1", "sku", "seller-42",
                "Product", 1, new Money(new BigDecimal("100000")), null)), FulfillmentStatus.SHIPPED,
                Money.ZERO, "STANDARD", "GHN", "tracking");
        Order order = new Order(orderId, "VNS-20260724-0003", "buyer-1", new Address("street", null, "district", "city"),
                List.of(subOrder), new Money(new BigDecimal("100000")), Money.ZERO, Money.ZERO, "COD",
                PaymentStatus.PENDING, "checkout-key");
        OrderRepositoryPort orders = mock(OrderRepositoryPort.class);
        OrderEventPublisherPort events = mock(OrderEventPublisherPort.class);
        when(orders.findById(orderId)).thenReturn(Optional.of(order));
        when(orders.save(order)).thenReturn(order);

        new ConfirmDeliveryUseCase(orders, events).confirm(orderId, 17L, "buyer-1");

        assertThat(order.paymentStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(subOrder.fulfillmentStatus()).isEqualTo(FulfillmentStatus.DELIVERED);
        verify(events).publishOrderDelivered(order, subOrder);
    }

    @Test
    void wrapsDeliveryAndOutboxWorkInOneTransaction() throws Exception {
        assertThat(ConfirmDeliveryUseCase.class
                .getMethod("confirm", UUID.class, Long.class, String.class)
                .getAnnotation(Transactional.class)).isNotNull();
    }
}
