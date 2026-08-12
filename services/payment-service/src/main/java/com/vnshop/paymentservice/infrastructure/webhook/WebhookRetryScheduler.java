package com.vnshop.paymentservice.infrastructure.webhook;

import com.vnshop.paymentservice.infrastructure.persistence.PendingWebhookJpaEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

/**
 * Picks up {@code PENDING} webhooks from {@code pending_webhooks} and republishes
 * them as {@link PendingWebhookRetryEvent}s so the original handler can reprocess
 * the payload. After {@code maxAttempts} the record is moved to {@code FAILED}
 * status, making it eligible for the DLT monitor in Track 6.3.
 *
 * <p>Back-off: 1 min after attempt 0, 5 min after attempt 1, 30 min after attempt 2+.
 * The scheduler runs every 30 seconds but only touches rows whose
 * {@code next_retry_at <= now}.
 */
@Service
public class WebhookRetryScheduler {

    private static final Logger log = LoggerFactory.getLogger(WebhookRetryScheduler.class);
    private static final int BATCH_SIZE = 50;

    private final WebhookIdempotencyService idempotencyService;
    private final ObjectProvider<PendingWebhookRetryProcessor> processorProvider;

    public WebhookRetryScheduler(
            WebhookIdempotencyService idempotencyService,
            ObjectProvider<PendingWebhookRetryProcessor> processorProvider) {
        this.idempotencyService = Objects.requireNonNull(idempotencyService, "idempotencyService is required");
        this.processorProvider = Objects.requireNonNull(processorProvider, "processorProvider is required");
    }

    @Scheduled(fixedDelay = 30_000)
    public void retryPendingWebhooks() {
        List<PendingWebhookJpaEntity> batch = idempotencyService.findRetryable(BATCH_SIZE);

        if (batch.isEmpty()) {
            return;
        }

        log.info("webhook-retry-scheduler-batch size={}", batch.size());

        for (PendingWebhookJpaEntity entity : batch) {
            if (!idempotencyService.claimForRetry(entity)) {
                continue;
            }
            try {
                PendingWebhookRetryProcessor processor = processorProvider.getIfAvailable();
                if (processor == null) {
                    throw new IllegalStateException("No pending webhook retry processor is configured");
                }
                processor.process(new PendingWebhookRetryEvent(
                        entity.getId(),
                        entity.getWebhookId(),
                        entity.getProvider(),
                        entity.getEventType(),
                        entity.getPayload()));
                idempotencyService.recordRetryOutcome(entity, true);
            } catch (Exception ex) {
                log.warn("webhook-retry-failed id={} provider={} webhookId={} attempt={} error={}",
                        entity.getId(), entity.getProvider(), entity.getWebhookId(),
                        entity.getAttempts(), ex.getMessage());
                idempotencyService.recordRetryOutcome(entity, false);
            }
        }
    }
}
