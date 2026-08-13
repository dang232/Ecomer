package com.vnshop.paymentservice.infrastructure.webhook;

import com.vnshop.paymentservice.infrastructure.persistence.PendingWebhookJpaEntity;
import com.vnshop.paymentservice.infrastructure.persistence.PendingWebhookSpringDataRepository;
import com.vnshop.paymentservice.infrastructure.persistence.ProcessedWebhookSpringDataRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Deduplicates inbound provider webhooks using the {@code processed_webhooks} table.
 * A (webhookId, provider) pair is the dedup key — the same event delivered twice
 * is idempotent: the second delivery returns immediately without re-processing.
 *
 * <p>Failures during processing are stored in {@code pending_webhooks} for
 * scheduled retry with exponential back-off (1 min → 5 min → 30 min).
 */
@Service
public class WebhookIdempotencyService {

    /** Back-off schedule in seconds: attempt 1 waits 60 s, 2 waits 300 s, 3 waits 1800 s. */
    private static final long[] BACKOFF_SECONDS = {60L, 300L, 1800L};
    private static final long RETRY_LEASE_SECONDS = 600L;

    private final ProcessedWebhookSpringDataRepository processedRepo;
    private final PendingWebhookSpringDataRepository pendingRepo;

    public WebhookIdempotencyService(
            ProcessedWebhookSpringDataRepository processedRepo,
            PendingWebhookSpringDataRepository pendingRepo) {
        this.processedRepo = Objects.requireNonNull(processedRepo, "processedRepo is required");
        this.pendingRepo = Objects.requireNonNull(pendingRepo, "pendingRepo is required");
    }

    /**
     * Returns {@code true} when this (webhookId, provider) pair has already been
     * successfully processed and the caller should return 200 immediately.
     */
    @Transactional(readOnly = true)
    public boolean isAlreadyProcessed(String webhookId, String provider) {
        return processedRepo.existsByWebhookIdAndProvider(webhookId, provider);
    }

    /**
     * Records a successfully processed webhook. Uses {@code REQUIRES_NEW} so a later
     * rollback in the outer tx does not un-mark the event (the provider already
     * received 200).
     *
     * <p>The database performs an atomic insert-if-absent, so a concurrent duplicate
     * is handled without relying on deferred ORM constraint exceptions.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markProcessed(String webhookId, String provider, String eventType) {
        processedRepo.insertIfAbsent(webhookId, provider, eventType, Instant.now());
    }

    /**
     * Stores a failed webhook for later retry. The first retry fires after 1 minute.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void storePendingForRetry(String webhookId, String provider, String eventType, String payload) {
        pendingRepo.insertIfAbsent(
                webhookId,
                provider,
                eventType,
                payload,
                Instant.now().plusSeconds(BACKOFF_SECONDS[0]));
    }

    /**
     * Returns the next batch of retryable pending entries.
     * Called exclusively by {@link WebhookRetryScheduler}.
     */
    @Transactional(readOnly = true)
    public List<PendingWebhookJpaEntity> findRetryable(int batchSize) {
        return pendingRepo.findRetryable(Instant.now(), PageRequest.of(0, batchSize));
    }

    @Transactional
    public boolean claimForRetry(PendingWebhookJpaEntity entity) {
        Instant now = Instant.now();
        UUID leaseToken = UUID.randomUUID();
        boolean claimed = pendingRepo.claim(
                entity.getId(), now, now.plusSeconds(RETRY_LEASE_SECONDS), leaseToken) > 0;
        entity.setLeaseToken(claimed ? leaseToken : null);
        return claimed;
    }

    /**
     * Advances the retry counter and schedules the next attempt, or marks the
     * record {@code FAILED} when {@code maxAttempts} is exhausted.
     */
    @Transactional
    public void recordRetryOutcome(PendingWebhookJpaEntity entity, boolean succeeded) {
        UUID leaseToken = entity.getLeaseToken();
        if (leaseToken == null) {
            return;
        }
        if (succeeded) {
            pendingRepo.markProcessed(entity.getId(), leaseToken);
            return;
        }

        int next = entity.getAttempts() + 1;
        boolean exhausted = next >= entity.getMaxAttempts();
        String status = exhausted ? "FAILED" : "PENDING";
        Instant nextRetryAt = exhausted
                ? null
                : Instant.now().plusSeconds(next < BACKOFF_SECONDS.length
                        ? BACKOFF_SECONDS[next]
                        : BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1]);
        pendingRepo.recordFailure(entity.getId(), leaseToken, next, status, nextRetryAt);
    }
}
