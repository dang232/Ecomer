package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentStatus;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FindOrderByIdempotencyKeyUseCaseTest {
    private final OrderRepositoryPort orders = mock(OrderRepositoryPort.class);
    private final FindOrderByIdempotencyKeyUseCase useCase = new FindOrderByIdempotencyKeyUseCase(orders);

    @Test
    void returnsThePersistedOrderOnlyForItsBuyer() {
        Order order = order("buyer-1", "checkout-key");
        when(orders.findByIdempotencyKey("checkout-key")).thenReturn(Optional.of(order));

        Order result = useCase.findForBuyer("checkout-key", "buyer-1");

        assertThat(result).isSameAs(order);
    }

    @Test
    void masksAnUnknownKeyAndAnotherBuyersKeyAsTheSameNotFoundResult() {
        when(orders.findByIdempotencyKey("unknown")).thenReturn(Optional.empty());
        when(orders.findByIdempotencyKey("owned-by-someone-else"))
                .thenReturn(Optional.of(order("buyer-1", "owned-by-someone-else")));

        assertThatThrownBy(() -> useCase.findForBuyer("unknown", "buyer-2"))
                .isInstanceOf(FindOrderByIdempotencyKeyUseCase.OrderByIdempotencyKeyNotFoundException.class)
                .hasMessage("order not found");
        assertThatThrownBy(() -> useCase.findForBuyer("owned-by-someone-else", "buyer-2"))
                .isInstanceOf(FindOrderByIdempotencyKeyUseCase.OrderByIdempotencyKeyNotFoundException.class)
                .hasMessage("order not found");
    }

    @Test
    void rejectsBlankAndOversizedKeysBeforeRepositoryAccess() {
        assertThatThrownBy(() -> useCase.findForBuyer(" ", "buyer-1"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> useCase.findForBuyer("x".repeat(256), "buyer-1"))
                .isInstanceOf(IllegalArgumentException.class);

        verify(orders, never()).findByIdempotencyKey(org.mockito.ArgumentMatchers.anyString());
    }

    private static Order order(String buyerId, String key) {
        Money price = new Money(new BigDecimal("10000"), "VND");
        OrderItem item = new OrderItem("product-1", "sku-1", "seller-1", "Phone", 1, price, null);
        SubOrder subOrder = new SubOrder(1L, "seller-1", List.of(item), FulfillmentStatus.PENDING_ACCEPTANCE,
                Money.ZERO, "STANDARD", null, null);
        return new Order(UUID.randomUUID(), "VNS-1", buyerId,
                new Address("1 Main Street", "Ward", "District", "HCMC"), List.of(subOrder),
                price, Money.ZERO, Money.ZERO, "COD", PaymentStatus.PENDING, key);
    }
}
