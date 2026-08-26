package com.vnshop.paymentservice.infrastructure.reconciliation;

import com.vnshop.paymentservice.domain.port.out.PaymentIdempotencyKeyRepositoryPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class PaymentIdempotencyClaimReconciliation {
    private final PaymentIdempotencyKeyRepositoryPort repository;
    private final Duration claimTtl;

    public PaymentIdempotencyClaimReconciliation(
            PaymentIdempotencyKeyRepositoryPort repository,
            @Value("${payment.idempotency.claim-ttl:15m}") Duration claimTtl) {
        this.repository = repository;
        this.claimTtl = claimTtl;
    }

    @Scheduled(fixedDelayString = "${payment.idempotency.reconciliation-interval-ms:60000}")
    public void reconcileAbandonedClaims() {
        repository.deleteAbandonedClaims(Instant.now().minus(claimTtl));
    }
}
