package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static com.vnshop.orderservice.application.TestFakes.orderWith;

import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.ReturnStatus;
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
}
