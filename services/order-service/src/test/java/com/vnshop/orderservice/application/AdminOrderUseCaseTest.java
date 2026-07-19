package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.vnshop.orderservice.application.coupon.CouponRedemptionService;
import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentStatus;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.orderservice.domain.port.out.OrderSummaryQueryPort;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdminOrderUseCaseTest {
    private static final Money TEN_THOUSAND = new Money(BigDecimal.valueOf(10_000), "VND");

    private final TestFakes.FakeOrderRepository repository = new TestFakes.FakeOrderRepository();
    private final RecordingInventory inventory = new RecordingInventory();
    private final TestFakes.RecordingOrderEvents events = new TestFakes.RecordingOrderEvents();
    private final CouponRedemptionService coupons = mock(CouponRedemptionService.class);
    private final AdminOrderUseCase useCase = new AdminOrderUseCase(
            repository, mock(OrderSummaryQueryPort.class), inventory, events, coupons);

    @Test
    void forceCancelReleasesCouponExactlyOnceAcrossRetries() {
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithPendingSubOrder(orderId));

        Order cancelled = useCase.forceCancel(orderId);
        useCase.forceCancel(orderId);

        assertThat(cancelled.subOrders().getFirst().fulfillmentStatus())
                .isEqualTo(FulfillmentStatus.CANCELLED);
        assertThat(inventory.released).containsExactly(orderId.toString());
        verify(coupons, times(1)).release(orderId);
    }

    @Test
    void changeStatusToCancelledReleasesCouponExactlyOnceAcrossRetries() {
        UUID orderId = UUID.randomUUID();
        repository.save(orderWithPendingSubOrder(orderId));

        useCase.changeStatus(orderId, "CANCELLED");
        useCase.changeStatus(orderId, "CANCELLED");

        verify(coupons, times(1)).release(orderId);
    }

    private static Order orderWithPendingSubOrder(UUID orderId) {
        OrderItem item = new OrderItem(
                "product-1", "P-1", "seller-1", "Phone", 1, TEN_THOUSAND, null);
        SubOrder subOrder = new SubOrder(
                100L, "seller-1", List.of(item), FulfillmentStatus.PENDING_ACCEPTANCE,
                Money.ZERO, "STANDARD", null, null);
        Address shippingAddress = new Address("123 Day Street", "Ward 1", "District 1", "HCMC");
        return new Order(
                orderId, "ORD-1", "buyer-1", shippingAddress, List.of(subOrder),
                TEN_THOUSAND, Money.ZERO, Money.ZERO, "COD", PaymentStatus.PENDING, "idem-1");
    }

    private static final class RecordingInventory implements InventoryReservationPort {
        private final List<String> released = new ArrayList<>();

        @Override
        public void reserve(String orderId, List<OrderItem> items) {}

        @Override
        public void release(String orderId) {
            released.add(orderId);
        }
    }
}
