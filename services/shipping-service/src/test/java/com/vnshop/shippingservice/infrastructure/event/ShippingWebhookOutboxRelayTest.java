package com.vnshop.shippingservice.infrastructure.event;

import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.domain.model.CarrierWebhookOutboxRecord;
import com.vnshop.shippingservice.domain.port.out.CarrierWebhookOutboxPort;
import com.vnshop.shippingservice.domain.port.out.ShippingStatusEventPublisherPort;
import com.vnshop.shippingservice.infrastructure.config.ShippingWebhookOutboxProperties;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShippingWebhookOutboxRelayTest {

    @Test
    void failedPublish_usesConfiguredRetryPolicy() {
        CarrierWebhookOutboxPort outbox = mock(CarrierWebhookOutboxPort.class);
        ShippingStatusEventPublisherPort publisher = mock(ShippingStatusEventPublisherPort.class);
        CarrierWebhookOutboxRecord record = recordWithAttempts(2);
        ShippingWebhookOutboxProperties properties = new ShippingWebhookOutboxProperties(
                7, 250, 10_000, 3, 4, 20, 2, 500);
        ShippingWebhookOutboxRelay relay = new ShippingWebhookOutboxRelay(outbox, publisher, properties);

        when(outbox.findPending(7)).thenReturn(List.of(record));
        when(outbox.claim(record.id())).thenReturn(true);
        when(publisher.publishStatusUpdate(record.event()))
                .thenReturn(CompletableFuture.failedFuture(new IllegalStateException("broker unavailable")));

        relay.publishPending();

        verify(outbox).recoverStaleClaims(any(Instant.class));
        verify(outbox).findPending(7);
        verify(outbox).recordFailure(eq(record.id()), eq(3), eq(null), eq(true), eq("broker unavailable"));
    }

    private static CarrierWebhookOutboxRecord recordWithAttempts(int attempts) {
        CarrierWebhookEvent event = new CarrierWebhookEvent(
                "GHN:GHN-1:2026-07-21T10:30:00Z",
                "order-1",
                "GHN",
                "GHN-1",
                "DELIVERED",
                "Delivered",
                "2026-07-21T10:30:00Z");
        return new CarrierWebhookOutboxRecord(UUID.randomUUID(), event, attempts, null);
    }
}
