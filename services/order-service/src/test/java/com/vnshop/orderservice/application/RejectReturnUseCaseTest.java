package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.orderservice.domain.Address;
import com.vnshop.orderservice.domain.FulfillmentStatus;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.PaymentStatus;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.ReturnStatus;
import com.vnshop.orderservice.domain.SubOrder;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The shared ReturnAuthorization gate is exercised by ApproveReturnUseCaseTest;
 * this class only pins the REQUESTED -> REJECTED transition itself plus a
 * spot-check that the gate denies wrong sellers without mutating state. A
 * future change to Return.reject() (e.g. emitting an event, freeing inventory,
 * adjusting state-machine guards) would otherwise have no test signal.
 */
class RejectReturnUseCaseTest {
    private static final String SELLER_OWNER = "seller-1";
    private static final String SELLER_ATTACKER = "seller-2";
    private static final Money TEN_THOUSAND = new Money(BigDecimal.valueOf(10_000), "VND");

    private final TestFakes.FakeReturnRepository returns = new TestFakes.FakeReturnRepository();
    private final TestFakes.FakeOrderRepository orders = new TestFakes.FakeOrderRepository();
    private final RejectReturnUseCase useCase = new RejectReturnUseCase(returns, orders);

    @Test
    void rejectTransitionsRequestedReturnToRejected() {
        UUID orderId = UUID.randomUUID();
        UUID returnId = UUID.randomUUID();
        Long subOrderId = 100L;
        orders.save(orderWith(orderId, subOrderId, SELLER_OWNER));
        returns.save(new Return(returnId, orderId.toString(), subOrderId, "buyer-1", "broken"));

        Return rejected = useCase.reject(returnId, SELLER_OWNER, "SELLER");

        assertThat(rejected.status()).isEqualTo(ReturnStatus.REJECTED);
        assertThat(returns.findById(returnId).orElseThrow().status())
                .isEqualTo(ReturnStatus.REJECTED);
    }

    @Test
    void rejectByWrongSellerLeavesReturnInRequestedState() {
        // Spot-check the gate denies; full gate-branch coverage lives in
        // ApproveReturnUseCaseTest. Here we only need to confirm reject()
        // also wires through the same authorization helper without mutating
        // the return on failure.
        UUID orderId = UUID.randomUUID();
        UUID returnId = UUID.randomUUID();
        Long subOrderId = 100L;
        orders.save(orderWith(orderId, subOrderId, SELLER_OWNER));
        returns.save(new Return(returnId, orderId.toString(), subOrderId, "buyer-1", "broken"));

        assertThatThrownBy(() -> useCase.reject(returnId, SELLER_ATTACKER, "SELLER"))
                .isInstanceOf(OrderAccessDeniedException.class);
        assertThat(returns.findById(returnId).orElseThrow().status())
                .isEqualTo(ReturnStatus.REQUESTED);
    }

    private static Order orderWith(UUID orderId, Long subOrderId, String sellerId) {
        OrderItem item = new OrderItem("product-1", "P-1", sellerId, "Phone", 1, TEN_THOUSAND, null);
        SubOrder subOrder = new SubOrder(subOrderId, sellerId, List.of(item),
                FulfillmentStatus.SHIPPED, Money.ZERO, "STANDARD", "GHN", "TRK-1");
        Address shippingAddress = new Address("123 Day Street", "Ward 1", "District 1", "HCMC");
        return new Order(orderId, "ORD-1", "buyer-1", shippingAddress, List.of(subOrder),
                TEN_THOUSAND, Money.ZERO, Money.ZERO,
                "COD", PaymentStatus.COMPLETED, "idem-1");
    }
}
