package com.vnshop.paymentservice.infrastructure.webhook;

import com.vnshop.paymentservice.infrastructure.persistence.PendingWebhookJpaEntity;
import com.vnshop.paymentservice.infrastructure.persistence.PendingWebhookSpringDataRepository;
import com.vnshop.paymentservice.infrastructure.persistence.ProcessedWebhookSpringDataRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WebhookIdempotencyServiceTest {
    @Test
    void finalizesRetryOnlyWithTheLeaseTokenGrantedByClaim() {
        ProcessedWebhookSpringDataRepository processedRepo = mock(ProcessedWebhookSpringDataRepository.class);
        PendingWebhookSpringDataRepository pendingRepo = mock(PendingWebhookSpringDataRepository.class);
        PendingWebhookJpaEntity entity = new PendingWebhookJpaEntity(
                "evt-1", "STRIPE", "payment_intent.succeeded", "{}");
        when(pendingRepo.claim(any(), any(), any(), any())).thenAnswer(invocation -> {
            entity.setLeaseToken(invocation.getArgument(3));
            return 1;
        });

        WebhookIdempotencyService service = new WebhookIdempotencyService(processedRepo, pendingRepo);

        assertThat(service.claimForRetry(entity)).isTrue();
        service.recordRetryOutcome(entity, true);

        verify(pendingRepo).markProcessed(entity.getId(), entity.getLeaseToken());
    }

    @Test
    void doesNotFinalizeWhenClaimWasLost() {
        ProcessedWebhookSpringDataRepository processedRepo = mock(ProcessedWebhookSpringDataRepository.class);
        PendingWebhookSpringDataRepository pendingRepo = mock(PendingWebhookSpringDataRepository.class);
        PendingWebhookJpaEntity entity = new PendingWebhookJpaEntity(
                "evt-2", "STRIPE", "payment_intent.succeeded", "{}");
        when(pendingRepo.claim(any(), any(), any(), any())).thenReturn(0);

        WebhookIdempotencyService service = new WebhookIdempotencyService(processedRepo, pendingRepo);

        assertThat(service.claimForRetry(entity)).isFalse();
        service.recordRetryOutcome(entity, false);

        verify(pendingRepo, org.mockito.Mockito.never()).markProcessed(any(), any());
        verify(pendingRepo, org.mockito.Mockito.never()).recordFailure(any(), any(), any(Integer.class), any(), any());
    }
}
