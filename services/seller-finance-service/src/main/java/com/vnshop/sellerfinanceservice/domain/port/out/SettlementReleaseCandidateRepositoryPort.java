package com.vnshop.sellerfinanceservice.domain.port.out;

import com.vnshop.sellerfinanceservice.domain.FinancialAdjustment;
import com.vnshop.sellerfinanceservice.domain.SettlementReleaseCandidate;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface SettlementReleaseCandidateRepositoryPort {
    void recordAdjustment(FinancialAdjustment adjustment);

    void markDelivered(UUID orderId, long subOrderId, Instant deliveredAt);

    void updateHold(UUID orderId, Long subOrderId, String holdType, boolean open);

    List<SettlementReleaseCandidate> lockEligible(Instant asOf, int batchSize);

    void markReleased(UUID allocationId, UUID releaseOperationId, Instant releasedAt);
}
