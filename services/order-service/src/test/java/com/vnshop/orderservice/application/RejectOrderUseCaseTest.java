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
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderEventPublisherPort;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Pt38 audit (extends pt37): RejectOrderUseCase had the same access-control
 * shape as Ship/AcceptOrderUseCase — IllegalArgumentException + sellerId
 * leak in the message. Same fix, same test pattern.
 */
class RejectOrderUseCaseTest {
    private static final Money TEN_THOUSAND = new Money(BigDecimal.valueOf(10_000), "VND");

    private final TestFakes.FakeOrderRepository repository = new TestFakes.FakeOrderRepository();
    private final RecordingInventory inventory = new RecordingInventory();
    private final TestFakes.RecordingOrderEvents events = new TestFakes.RecordingOrderEvents();
    private final RejectOrderUseCase useCase = new RejectOrderUseCase(repository, inventory, events);

    @Test
    void rejectFlipsFulfillmentAndReleasesInventoryForOwningSeller() {
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithPendingSubOrder(orderId, "seller-1"));

        Order rejected = useCase.reject(orderId, "seller-1");

        assertThat(rejected.subOrders().get(0).fulfillmentStatus())
                .isEqualTo(FulfillmentStatus.REJECTED);
        assertThat(inventory.released).containsExactly(orderId.toString());
        assertThat(events.updates).hasSize(1);
    }

    @Test
    void rejectThrowsAccessDeniedWhenSellerDoesNotOwnTheSubOrder() {
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithPendingSubOrder(orderId, "seller-1"));

        assertThatThrownBy(() -> useCase.reject(orderId, "seller-2"))
                .isInstanceOf(OrderAccessDeniedException.class)
                .hasMessage("not authorized to reject this order");
        assertThat(inventory.released).isEmpty();
        assertThat(events.updates).isEmpty();
    }

    @Test
    void rejectDoesNotLeakRequestedSellerIdInTheErrorMessage() {
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithPendingSubOrder(orderId, "seller-1"));

        assertThatThrownBy(() -> useCase.reject(orderId, "guess-target-seller-x"))
                .hasMessageNotContaining("guess-target-seller-x");
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

    private static final class RecordingInventory implements InventoryReservationPort {
        final List<String> released = new ArrayList<>();
        @Override public void reserve(String orderId, List<OrderItem> items) {}
        @Override public void release(String orderId) { released.add(orderId); }
    }

}
