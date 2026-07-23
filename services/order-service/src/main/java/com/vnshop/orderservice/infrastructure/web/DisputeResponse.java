package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.EnrichedDispute;
import com.vnshop.orderservice.domain.Dispute;
import java.time.Instant;

public record DisputeResponse(
        String disputeId,
        String returnId,
        String buyerReason,
        String sellerResponse,
        String adminResolution,
        String resolvedBy,
        String status,
        String orderId,
        String orderNumber,
        String buyerId,
        String buyerName,
        String sellerId,
        String sellerName,
        Instant createdAt
) {

    static DisputeResponse fromDomain(Dispute dispute) {
        return new DisputeResponse(
                dispute.disputeId().toString(),
                dispute.returnId(),
                dispute.buyerReason(),
                dispute.sellerResponse(),
                dispute.adminResolution(),
                dispute.resolvedBy(),
                dispute.status().name(),
                null, null, null, null, null, null, null
        );
    }

    static DisputeResponse fromEnriched(EnrichedDispute enriched) {
        DisputeResponse base = fromDomain(enriched.dispute());
        return new DisputeResponse(base.disputeId(), base.returnId(), base.buyerReason(), base.sellerResponse(),
                base.adminResolution(), base.resolvedBy(), base.status(), enriched.orderId(), enriched.orderNumber(),
                enriched.buyerId(), enriched.buyerName(), enriched.sellerId(), enriched.sellerName(), enriched.createdAt());
    }
}
