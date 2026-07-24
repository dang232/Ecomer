package com.vnshop.sellerfinanceservice.application;

import com.vnshop.sellerfinanceservice.domain.SettlementReleaseCandidate;
import com.vnshop.sellerfinanceservice.domain.port.out.SettlementReleaseCandidateRepositoryPort;
import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import org.springframework.transaction.annotation.Transactional;

/** Releases delivered allocations after seven days when every hold gate is clear. */
public class ReleaseEligibleSettlementsUseCase {
    private final SettlementReleaseCandidateRepositoryPort candidateRepository;
    private final ApplyFinancialAdjustmentUseCase adjustmentUseCase;
    private final Clock clock;
    private final int batchSize;

    public ReleaseEligibleSettlementsUseCase(
            SettlementReleaseCandidateRepositoryPort candidateRepository,
            ApplyFinancialAdjustmentUseCase adjustmentUseCase,
            Clock clock,
            int batchSize) {
        this.candidateRepository = Objects.requireNonNull(candidateRepository, "candidateRepository is required");
        this.adjustmentUseCase = Objects.requireNonNull(adjustmentUseCase, "adjustmentUseCase is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
        if (batchSize < 1) throw new IllegalArgumentException("batchSize must be positive");
        this.batchSize = batchSize;
    }

    @Transactional
    public int releaseEligible() {
        Instant now = Instant.now(clock);
        int released = 0;
        for (SettlementReleaseCandidate candidate : candidateRepository.lockEligible(now, batchSize)) {
            adjustmentUseCase.apply(candidate.automaticRelease(now));
            candidateRepository.markReleased(candidate.allocationId(), candidate.releaseOperationId(), now);
            released++;
        }
        return released;
    }
}
