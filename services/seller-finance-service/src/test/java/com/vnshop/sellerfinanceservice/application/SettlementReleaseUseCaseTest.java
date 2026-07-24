package com.vnshop.sellerfinanceservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.sellerfinanceservice.domain.FinancialAdjustment;
import com.vnshop.sellerfinanceservice.domain.SettlementReleaseCandidate;
import com.vnshop.sellerfinanceservice.domain.port.out.SettlementReleaseCandidateRepositoryPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SettlementReleaseUseCaseTest {
    private static final Instant NOW = Instant.parse("2026-07-24T00:00:00Z");

    @Test
    void releasesOnlyEligibleCandidatesWithAStableOperationKey() {
        SettlementReleaseCandidateRepositoryPort candidates = mock(SettlementReleaseCandidateRepositoryPort.class);
        ApplyFinancialAdjustmentUseCase adjustments = mock(ApplyFinancialAdjustmentUseCase.class);
        UUID allocationId = UUID.randomUUID();
        SettlementReleaseCandidate candidate = candidate(allocationId, NOW.minusSeconds(8 * 86_400L), false, false, false, false);
        when(candidates.lockEligible(NOW, 10)).thenReturn(List.of(candidate));
        when(adjustments.apply(any())).thenReturn(new ApplyFinancialAdjustmentUseCase.ApplyResult(
                UUID.randomUUID(), UUID.randomUUID()));

        ReleaseEligibleSettlementsUseCase useCase = new ReleaseEligibleSettlementsUseCase(
                candidates, adjustments, Clock.fixed(NOW, ZoneOffset.UTC), 10);

        assertThat(useCase.releaseEligible()).isEqualTo(1);
        verify(adjustments).apply(any(FinancialAdjustment.class));
        verify(candidates).markReleased(allocationId, candidate.releaseOperationId(), NOW);
    }

    @Test
    void candidateEligibilityBlocksEveryHoldGateAndRequiresSevenDays() {
        Instant delivered = NOW.minusSeconds(7 * 86_400L);
        assertThat(candidate(UUID.randomUUID(), delivered, false, false, false, false).eligibleAt(NOW)).isTrue();
        assertThat(candidate(UUID.randomUUID(), delivered, true, false, false, false).eligibleAt(NOW)).isFalse();
        assertThat(candidate(UUID.randomUUID(), delivered, false, true, false, false).eligibleAt(NOW)).isFalse();
        assertThat(candidate(UUID.randomUUID(), delivered, false, false, true, false).eligibleAt(NOW)).isFalse();
        assertThat(candidate(UUID.randomUUID(), delivered, false, false, false, true).eligibleAt(NOW)).isFalse();
        assertThat(candidate(UUID.randomUUID(), NOW.minusSeconds(6 * 86_400L), false, false, false, false)
                .eligibleAt(NOW)).isFalse();
    }

    private static SettlementReleaseCandidate candidate(UUID allocationId, Instant deliveredAt,
                                                        boolean returnHold, boolean disputeHold,
                                                        boolean fraudHold, boolean chargebackHold) {
        return new SettlementReleaseCandidate(
                allocationId, 1, UUID.randomUUID(), 42L, "seller-1", "STANDARD", new BigDecimal("0.10"),
                components(), deliveredAt, returnHold, disputeHold, fraudHold, chargebackHold,
                SettlementReleaseCandidate.ReleaseStatus.PENDING,
                SettlementReleaseCandidate.releaseOperationId(allocationId), null);
    }

    private static FinancialAdjustment.Components components() {
        return new FinancialAdjustment.Components(
                new BigDecimal("100000"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("100000"),
                new BigDecimal("10000"), new BigDecimal("90000"), new BigDecimal("100000"), "VND");
    }
}
