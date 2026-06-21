package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentStatus;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Pt37 audit: same shape as ShipOrderUseCaseTest. AcceptOrderUseCase had
 * the same access-denied-as-IAE bug — fixed in the same block.
 */
class AcceptOrderUseCaseTest {
    private static final Money TEN_THOUSAND = new Money(BigDecimal.valueOf(10_000), "VND");

    private final TestFakes.FakeOrderRepository repository = new TestFakes.FakeOrderRepository();
    private final TestFakes.RecordingOrderEvents events = new TestFakes.RecordingOrderEvents();
    private final AcceptOrderUseCase useCase = new AcceptOrderUseCase(repository, events);

    @Test
    void acceptFlipsFulfillmentStatusAndPublishesEvent() {
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithPendingSubOrder(orderId, "seller-1"));

        Order accepted = useCase.accept(orderId, "seller-1");

        assertThat(accepted.subOrders().get(0).fulfillmentStatus())
                .isEqualTo(FulfillmentStatus.ACCEPTED);
        assertThat(events.updates).hasSize(1);
    }

    @Test
    void acceptThrowsAccessDeniedWhenSellerDoesNotOwnTheSubOrder() {
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithPendingSubOrder(orderId, "seller-1"));

        assertThatThrownBy(() -> useCase.accept(orderId, "seller-2"))
                .isInstanceOf(OrderAccessDeniedException.class)
                .hasMessage("not authorized to accept this order");
        assertThat(events.updates).isEmpty();
    }

    @Test
    void acceptDoesNotLeakRequestedSellerIdInTheErrorMessage() {
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithPendingSubOrder(orderId, "seller-1"));

        assertThatThrownBy(() -> useCase.accept(orderId, "guess-target-seller-x"))
                .hasMessageNotContaining("guess-target-seller-x");
    }

    @Test
    void acceptThrowsAccessDeniedForUnknownOrder() {
        // Pt40 audit: status-code parity with ownership-rejection
        // (same constant message + same exception type).
        assertThatThrownBy(() -> useCase.accept(UUID.randomUUID(), "seller-1"))
                .isInstanceOf(OrderAccessDeniedException.class)
                .hasMessage("not authorized to accept this order");
    }

    private static Order orderWithPendingSubOrder(UUID orderId, String sellerId) {
        OrderItem item = new OrderItem("product-1", "P-1", sellerId, "Phone", 1, TEN_THOUSAND, null);
        SubOrder subOrder = new SubOrder(100L, sellerId, List.of(item),
                FulfillmentStatus.PENDING_ACCEPTANCE, Money.ZERO, "STANDARD", null, null);
        Address shippingAddress = new Address("123 Day Street", "Ward 1", "District 1", "HCMC");
        return new Order(orderId, "ORD-1", "buyer-1", shippingAddress, List.of(subOrder),
                TEN_THOUSAND, Money.ZERO, Money.ZERO,
                "COD", PaymentStatus.PENDING, "idem-1");
    }

}
