package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.CommissionTier;
import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentStatus;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.ReturnStatus;
import com.vnshop.orderservice.domain.ShippingInfo;
import com.vnshop.orderservice.domain.SubOrder;
import com.vnshop.orderservice.domain.port.out.RefundRequestPort;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdminRefundUseCaseTest {
    private static final Money PRICE = new Money(BigDecimal.valueOf(10_000), "VND");

    @Test
    void routesEachSubOrderThroughReturnCompletionAndIsIdempotent() {
        TestFakes.FakeOrderRepository orders = new TestFakes.FakeOrderRepository();
        TestFakes.FakeReturnRepository returns = new TestFakes.FakeReturnRepository();
        RecordingRefundPort refunds = new RecordingRefundPort();
        UUID orderId = UUID.randomUUID();
        orders.save(orderWithTwoSellers(orderId));
        CompleteReturnUseCase complete = new CompleteReturnUseCase(returns, orders, refunds);
        AdminRefundUseCase useCase = new AdminRefundUseCase(
                orders, returns, new ApproveReturnUseCase(returns, orders), complete);

        AdminRefundUseCase.AdminRefundResult first = useCase.refund(orderId, "admin decision");
        AdminRefundUseCase.AdminRefundResult retry = useCase.refund(orderId, "same decision");

        assertThat(first.returnIds()).hasSize(2);
        assertThat(retry.returnIds()).containsExactlyInAnyOrderElementsOf(first.returnIds());
        assertThat(refunds.calls).hasSize(2);
        assertThat(first.returnIds()).allSatisfy(id ->
                assertThat(returns.findById(id).orElseThrow().status()).isEqualTo(ReturnStatus.COMPLETED));
    }

    private static Order orderWithTwoSellers(UUID orderId) {
        SubOrder first = subOrder(100L, "seller-1");
        SubOrder second = subOrder(101L, "seller-2");
        return new Order(orderId, "ORD-1", "buyer-1", new Address("street", "ward", "district", "city"),
                List.of(first, second), new Money(BigDecimal.valueOf(20_000), "VND"), Money.ZERO, Money.ZERO,
                "COD", PaymentStatus.COMPLETED, "idem-1");
    }

    private static SubOrder subOrder(Long id, String sellerId) {
        return new SubOrder(id, sellerId,
                List.of(new OrderItem("product-" + id, "SKU-" + id, sellerId, "Product", 1, PRICE, null)),
                FulfillmentStatus.SHIPPED,
                new ShippingInfo(Money.ZERO, "STANDARD", "GHN", "TRK-" + id),
                CommissionTier.STANDARD);
    }

    private static final class RecordingRefundPort implements RefundRequestPort {
        private final List<UUID> calls = new java.util.ArrayList<>();

        @Override
        public void requestRefund(Return orderReturn, String sellerId, Money amount, CommissionTier commissionTier) {
            calls.add(orderReturn.returnId());
        }
    }
}
