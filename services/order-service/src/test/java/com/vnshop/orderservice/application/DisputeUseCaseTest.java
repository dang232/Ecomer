package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.orderservice.domain.Dispute;
import com.vnshop.orderservice.domain.DisputeStatus;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.port.out.DisputeRepositoryPort;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DisputeUseCaseTest {
    private final TestFakes.FakeReturnRepository returns = new TestFakes.FakeReturnRepository();
    private final FakeDisputeRepository disputes = new FakeDisputeRepository();
    private final DisputeUseCase useCase = new DisputeUseCase(returns, disputes);

    @Test
    void openCreatesDisputeWhenBuyerOwnsTheReturn() {
        UUID returnId = UUID.randomUUID();
        returns.save(new Return(returnId, UUID.randomUUID().toString(), 1L, "buyer-1", "broken"));

        Dispute dispute = useCase.open(returnId, "buyer-1", "still broken", "we shipped fine");

        assertThat(dispute.returnId()).isEqualTo(returnId.toString());
        assertThat(dispute.buyerReason()).isEqualTo("still broken");
        assertThat(dispute.sellerResponse()).isEqualTo("we shipped fine");
        assertThat(dispute.status()).isEqualTo(DisputeStatus.OPEN);
        assertThat(disputes.saved).hasSize(1);
    }

    @Test
    void openByWrongBuyerThrowsAccessDenied() {
        // Pt14 audit: any buyer who guesses a returnId UUID could otherwise
        // pollute the admin disputes queue with bogus rows.
        UUID returnId = UUID.randomUUID();
        returns.save(new Return(returnId, UUID.randomUUID().toString(), 1L, "buyer-1", "broken"));

        assertThatThrownBy(() -> useCase.open(returnId, "buyer-2", "fake reason", null))
                .isInstanceOf(OrderAccessDeniedException.class);
        assertThat(disputes.saved).isEmpty();
    }

    @Test
    void openRejectsBlankBuyerId() {
        UUID returnId = UUID.randomUUID();
        returns.save(new Return(returnId, UUID.randomUUID().toString(), 1L, "buyer-1", "broken"));

        assertThatThrownBy(() -> useCase.open(returnId, "  ", "reason", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("buyerId");
        assertThat(disputes.saved).isEmpty();
    }

    @Test
    void openRejectsUnknownReturn() {
        assertThatThrownBy(() -> useCase.open(UUID.randomUUID(), "buyer-1", "reason", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("return not found");
        assertThat(disputes.saved).isEmpty();
    }

    @Test
    void resolveStampsBothResolutionAndAdminId() {
        UUID disputeId = UUID.randomUUID();
        disputes.save(new Dispute(disputeId, UUID.randomUUID().toString(), "broken", null));

        Dispute resolved = useCase.resolve(disputeId, "partial refund", "admin-42");

        assertThat(resolved.adminResolution()).isEqualTo("partial refund");
        assertThat(resolved.resolvedBy()).isEqualTo("admin-42");
        assertThat(resolved.status()).isEqualTo(DisputeStatus.RESOLVED);
    }

    @Test
    void resolveRejectsUnknownDispute() {
        assertThatThrownBy(() -> useCase.resolve(UUID.randomUUID(), "partial refund", "admin-42"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dispute not found");
    }

    private static final class FakeDisputeRepository implements DisputeRepositoryPort {
        final List<Dispute> saved = new ArrayList<>();
        private final Map<UUID, Dispute> byId = new HashMap<>();

        @Override
        public Dispute save(Dispute dispute) {
            saved.add(dispute);
            byId.put(dispute.disputeId(), dispute);
            return dispute;
        }

        @Override
        public Optional<Dispute> findById(UUID disputeId) {
            return Optional.ofNullable(byId.get(disputeId));
        }

        @Override
        public List<Dispute> findByStatus(String status) {
            return List.of();
        }

        @Override
        public Optional<Dispute> findByReturnId(String returnId) {
            return Optional.empty();
        }
    }
}
