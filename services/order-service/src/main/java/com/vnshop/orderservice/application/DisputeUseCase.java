package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.Dispute;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.port.out.DisputeRepositoryPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import com.vnshop.orderservice.domain.port.out.SettlementHoldPublisherPort;

import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public class DisputeUseCase {
    private final ReturnRepositoryPort returnRepository;
    private final DisputeRepositoryPort disputeRepository;
    private final SettlementHoldPublisherPort settlementHoldPublisher;

    public DisputeUseCase(ReturnRepositoryPort returnRepository, DisputeRepositoryPort disputeRepository) {
        this(returnRepository, disputeRepository, null);
    }

    public DisputeUseCase(ReturnRepositoryPort returnRepository, DisputeRepositoryPort disputeRepository,
                          SettlementHoldPublisherPort settlementHoldPublisher) {
        this.returnRepository = Objects.requireNonNull(returnRepository, "returnRepository is required");
        this.disputeRepository = Objects.requireNonNull(disputeRepository, "disputeRepository is required");
        this.settlementHoldPublisher = settlementHoldPublisher;
    }

    /**
     * Pt14 audit fix: only the buyer who opened the return may escalate it
     * into a dispute. Without this check any authenticated buyer could open
     * a dispute on any other buyer's return by guessing the returnId UUID,
     * which would surface in the admin disputes queue and waste admin time
     * with bogus rows.
     */
    @Transactional
    public Dispute open(UUID returnId, String buyerId, String buyerReason, String sellerResponse) {
        if (buyerId == null || buyerId.isBlank()) {
            throw new IllegalArgumentException("buyerId is required");
        }
        Return orderReturn = returnRepository.findById(returnId)
                .orElseThrow(() -> new IllegalArgumentException("return not found: " + returnId));
        if (!buyerId.equals(orderReturn.buyerId())) {
            throw new OrderAccessDeniedException(
                    "buyer " + buyerId + " does not own return " + returnId);
        }

        // BIZ-09: Prevent duplicate disputes for the same return.
        disputeRepository.findByReturnId(orderReturn.returnId().toString()).ifPresent(existing -> {
            throw new IllegalStateException("a dispute already exists for return " + returnId);
        });

        Dispute saved = disputeRepository.save(new Dispute(UUID.randomUUID(), orderReturn.returnId().toString(), buyerReason, sellerResponse));
        if (settlementHoldPublisher != null) {
            settlementHoldPublisher.publish(UUID.fromString(orderReturn.orderId()), orderReturn.subOrderId(), "DISPUTE", true);
        }
        return saved;
    }

    @Transactional
    public Dispute resolve(UUID disputeId, String adminResolution, String resolvedBy) {
        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new IllegalArgumentException("dispute not found: " + disputeId));
        dispute.resolve(adminResolution, resolvedBy);
        Dispute saved = disputeRepository.save(dispute);
        if (settlementHoldPublisher != null) {
            returnRepository.findById(UUID.fromString(saved.returnId())).ifPresent(orderReturn ->
                    settlementHoldPublisher.publish(UUID.fromString(orderReturn.orderId()), orderReturn.subOrderId(), "DISPUTE", false));
        }
        return saved;
    }
}
