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
 * Pt37 audit: ShipOrderUseCase used to throw IllegalArgumentException when
 * the caller wasn't the suborder's seller, which the controller surfaced as
 * 400. Two problems with that:
 *  - HTTP semantics: shipping someone else's order is a 403, not a 400.
 *  - The old message echoed the caller's sellerId back, turning the
 *    response into an authorization-test oracle (probe whether seller X
 *    has a suborder on order Y). Generic message is the fix.
 *
 * The fix changes the throw to OrderAccessDeniedException + a constant
 * message; this test pins it so a future refactor can't regress.
 */
class ShipOrderUseCaseTest {
    private static final Money TEN_THOUSAND = new Money(BigDecimal.valueOf(10_000), "VND");
    private static final String CARRIER = "GHN";
    private static final String TRACKING = "TRK-001";

    private final TestFakes.FakeOrderRepository repository = new TestFakes.FakeOrderRepository();
    private final TestFakes.RecordingOrderEvents events = new TestFakes.RecordingOrderEvents();
    private final ShipOrderUseCase useCase = new ShipOrderUseCase(repository, events);

    @Test
    void shipUpdatesSubOrderAndPublishesEventForOwningSeller() {
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithAcceptedSubOrder(orderId, "seller-1"));

        Order shipped = useCase.ship(new ShipOrderCommand(orderId, "seller-1", CARRIER, TRACKING));

        assertThat(shipped.subOrders().get(0).fulfillmentStatus())
                .isEqualTo(FulfillmentStatus.SHIPPED);
        assertThat(shipped.subOrders().get(0).trackingNumber()).isEqualTo(TRACKING);
        assertThat(events.updates).hasSize(1);
    }

    @Test
    void shipThrowsAccessDeniedWhenSellerDoesNotOwnTheSubOrder() {
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithAcceptedSubOrder(orderId, "seller-1"));

        assertThatThrownBy(() ->
                        useCase.ship(new ShipOrderCommand(orderId, "seller-2", CARRIER, TRACKING)))
                .isInstanceOf(OrderAccessDeniedException.class)
                .hasMessage("not authorized to ship this order");
        assertThat(events.updates).isEmpty();
    }

    @Test
    void shipDoesNotLeakRequestedSellerIdInTheErrorMessage() {
        // Pt37: the prior message included the caller's sellerId. A
        // malicious seller could probe the response body to learn which
        // sellers had a suborder on a given orderId. Pin the generic
        // message so a future refactor can't reintroduce the leak.
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithAcceptedSubOrder(orderId, "seller-1"));

        assertThatThrownBy(() ->
                        useCase.ship(new ShipOrderCommand(
                                orderId, "guess-target-seller-x", CARRIER, TRACKING)))
                .hasMessageNotContaining("guess-target-seller-x");
    }

    @Test
    void shipThrowsAccessDeniedForUnknownOrder() {
        // Pt40 audit: was IAE/400 + leaked orderId. Status-code parity
        // with the ownership-rejection branch closes the probe oracle.
        assertThatThrownBy(() ->
                        useCase.ship(new ShipOrderCommand(
                                UUID.randomUUID(), "seller-1", CARRIER, TRACKING)))
                .isInstanceOf(OrderAccessDeniedException.class)
                .hasMessage("not authorized to ship this order");
    }

    @Test
    void shipRejectsBlankCarrier() {
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithAcceptedSubOrder(orderId, "seller-1"));

        assertThatThrownBy(() ->
                        useCase.ship(new ShipOrderCommand(orderId, "seller-1", "", TRACKING)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shipRejectsBlankTrackingNumber() {
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithAcceptedSubOrder(orderId, "seller-1"));

        assertThatThrownBy(() ->
                        useCase.ship(new ShipOrderCommand(orderId, "seller-1", CARRIER, "")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static Order orderWithAcceptedSubOrder(UUID orderId, String sellerId) {
        OrderItem item = new OrderItem("product-1", "P-1", sellerId, "Phone", 1, TEN_THOUSAND, null);
        SubOrder subOrder = new SubOrder(100L, sellerId, List.of(item),
                FulfillmentStatus.ACCEPTED, Money.ZERO, "STANDARD", null, null);
        Address shippingAddress = new Address("123 Day Street", "Ward 1", "District 1", "HCMC");
        return new Order(orderId, "ORD-1", "buyer-1", shippingAddress, List.of(subOrder),
                TEN_THOUSAND, Money.ZERO, Money.ZERO,
                "COD", PaymentStatus.PENDING, "idem-1");
    }

}
