package com.vnshop.paymentservice.infrastructure.webhook;

import com.vnshop.paymentservice.infrastructure.persistence.PendingWebhookJpaEntity;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WebhookRetrySchedulerTest {

    @Test
    void processesOnlyAfterTheDatabaseClaimSucceeds() {
        WebhookIdempotencyService idempotency = mock(WebhookIdempotencyService.class);
        PendingWebhookRetryProcessor processor = mock(PendingWebhookRetryProcessor.class);
        ObjectProvider<PendingWebhookRetryProcessor> provider = provider(processor);
        PendingWebhookJpaEntity entity = mock(PendingWebhookJpaEntity.class);
        when(idempotency.findRetryable(50)).thenReturn(List.of(entity));
        when(idempotency.claimForRetry(entity)).thenReturn(false);

        new WebhookRetryScheduler(idempotency, provider).retryPendingWebhooks();

        verify(processor, never()).process(any());
        verify(idempotency, never()).recordRetryOutcome(any(), any(Boolean.class));
    }

    @Test
    void marksRetryProcessedOnlyAfterProcessorReturns() {
        WebhookIdempotencyService idempotency = mock(WebhookIdempotencyService.class);
        PendingWebhookRetryProcessor processor = mock(PendingWebhookRetryProcessor.class);
        ObjectProvider<PendingWebhookRetryProcessor> provider = provider(processor);
        PendingWebhookJpaEntity entity = mock(PendingWebhookJpaEntity.class);
        when(idempotency.findRetryable(50)).thenReturn(List.of(entity));
        when(idempotency.claimForRetry(entity)).thenReturn(true);

        new WebhookRetryScheduler(idempotency, provider).retryPendingWebhooks();

        verify(processor).process(any(PendingWebhookRetryEvent.class));
        verify(idempotency).recordRetryOutcome(entity, true);
    }

    @Test
    void recordsFailureWhenNoProcessorIsConfigured() {
        WebhookIdempotencyService idempotency = mock(WebhookIdempotencyService.class);
        ObjectProvider<PendingWebhookRetryProcessor> provider = provider(null);
        PendingWebhookJpaEntity entity = mock(PendingWebhookJpaEntity.class);
        when(idempotency.findRetryable(50)).thenReturn(List.of(entity));
        when(idempotency.claimForRetry(entity)).thenReturn(true);

        new WebhookRetryScheduler(idempotency, provider).retryPendingWebhooks();

        verify(idempotency).recordRetryOutcome(entity, false);
    }

    private static ObjectProvider<PendingWebhookRetryProcessor> provider(PendingWebhookRetryProcessor processor) {
        ObjectProvider<PendingWebhookRetryProcessor> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(processor);
        return provider;
    }
}
