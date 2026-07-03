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
 * Locks the pt15 ReturnAuthorization gate at the use-case boundary. Day-simulation
 * covers the HTTP 403 path; this test exercises each branch of
 * ReturnAuthorization.requireSellerOwnsReturn — including "no return saved on
 * mismatch", which the HTTP test can't see.
 *
 * RejectReturnUseCase is structurally identical (same gate, single state
 * transition); CompleteReturnUseCase adds a refund-port side-effect after
 * the gate. Covering Approve here is the highest-value of the three because
 * it sets the contract for the shared helper.
 */
class ApproveReturnUseCaseTest {
    private static final String SELLER_OWNER = "seller-1";
    private static final String SELLER_ATTACKER = "seller-2";

    private final TestFakes.FakeReturnRepository returns = new TestFakes.FakeReturnRepository();
    private final TestFakes.FakeOrderRepository orders = new TestFakes.FakeOrderRepository();
    private final ApproveReturnUseCase useCase = new ApproveReturnUseCase(returns, orders);

    @Test
    void approveTransitionsReturnWhenSellerOwnsSubOrder() {
        UUID orderId = UUID.randomUUID();
        UUID returnId = UUID.randomUUID();
        Long subOrderId = 100L;
        orders.save(orderWith(orderId, subOrderId, SELLER_OWNER));
        returns.save(new Return(returnId, orderId.toString(), subOrderId, "buyer-1", "broken"));

        Return approved = useCase.approve(returnId, SELLER_OWNER, "SELLER");

        assertThat(approved.status()).isEqualTo(ReturnStatus.APPROVED);
        // Saved row reflects the new status — controller-side cache invalidation
        // depends on the persisted state matching the returned domain object.
        assertThat(returns.findById(returnId).orElseThrow().status())
                .isEqualTo(ReturnStatus.APPROVED);
    }

    @Test
    void approveByWrongSellerThrowsAccessDeniedAndDoesNotMutateReturn() {
        UUID orderId = UUID.randomUUID();
        UUID returnId = UUID.randomUUID();
        Long subOrderId = 100L;
        orders.save(orderWith(orderId, subOrderId, SELLER_OWNER));
        returns.save(new Return(returnId, orderId.toString(), subOrderId, "buyer-1", "broken"));

        assertThatThrownBy(() -> useCase.approve(returnId, SELLER_ATTACKER, "SELLER"))
                .isInstanceOf(OrderAccessDeniedException.class);
        // Return stays REQUESTED — the gate fires before approve() mutates state.
        // Pt15 day-simulation can't assert this; only a unit test can.
        assertThat(returns.findById(returnId).orElseThrow().status())
                .isEqualTo(ReturnStatus.REQUESTED);
    }

    @Test
    void approveRejectsBlankSellerId() {
        UUID orderId = UUID.randomUUID();
        UUID returnId = UUID.randomUUID();
        Long subOrderId = 100L;
        orders.save(orderWith(orderId, subOrderId, SELLER_OWNER));
        returns.save(new Return(returnId, orderId.toString(), subOrderId, "buyer-1", "broken"));

        assertThatThrownBy(() -> useCase.approve(returnId, "  ", "SELLER"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sellerId");
        assertThat(returns.findById(returnId).orElseThrow().status())
                .isEqualTo(ReturnStatus.REQUESTED);
    }

    @Test
    void approveRejectsUnknownReturn() {
        // Pt40 audit: status-code parity with ownership-rejection.
        // Both branches now raise OAD with the same constant message.
        assertThatThrownBy(() -> useCase.approve(UUID.randomUUID(), SELLER_OWNER, "SELLER"))
                .isInstanceOf(OrderAccessDeniedException.class)
                .hasMessage("not authorized to act on this return");
    }

    @Test
    void approveRejectsReturnPointingAtMissingOrder() {
        // Edge case: a Return row exists but the Order referenced by orderId
        // is gone. Pt38 audit folded this into OrderAccessDenied with the
        // same constant message used for "wrong seller" — a malicious caller
        // probing returnIds shouldn't be able to distinguish "this exists
        // but you don't own it" from "the underlying order was deleted."
        UUID returnId = UUID.randomUUID();
        returns.save(new Return(returnId, UUID.randomUUID().toString(), 100L, "buyer-1", "broken"));

        assertThatThrownBy(() -> useCase.approve(returnId, SELLER_OWNER, "SELLER"))
                .isInstanceOf(OrderAccessDeniedException.class)
                .hasMessage("not authorized to act on this return");
    }

    @Test
    void approveAccessDeniedMessageDoesNotLeakRequestedSellerOrReturnId() {
        // Pt38 pin: prior message was
        // "seller " + sellerId + " does not own return " + returnId — both
        // values were echoed back, turning every 403 into a probe oracle
        // for "does seller X own return Y." Constant-message check ensures
        // a future "helpful" tweak can't reintroduce the leak.
        UUID orderId = UUID.randomUUID();
        UUID returnId = UUID.randomUUID();
        Long subOrderId = 100L;
        orders.save(orderWith(orderId, subOrderId, SELLER_OWNER));
        returns.save(new Return(returnId, orderId.toString(), subOrderId, "buyer-1", "broken"));
        String attackerSellerId = "guess-target-seller-xyz";

        assertThatThrownBy(() -> useCase.approve(returnId, attackerSellerId, "SELLER"))
                .hasMessage("not authorized to act on this return")
                .hasMessageNotContaining(attackerSellerId)
                .hasMessageNotContaining(returnId.toString());
    }
}
