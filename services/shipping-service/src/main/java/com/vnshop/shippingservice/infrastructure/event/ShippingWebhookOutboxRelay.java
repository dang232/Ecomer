package com.vnshop.shippingservice.infrastructure.event;

import com.vnshop.shippingservice.domain.model.CarrierWebhookOutboxRecord;
import com.vnshop.shippingservice.domain.port.out.CarrierWebhookOutboxPort;
import com.vnshop.shippingservice.domain.port.out.ShippingStatusEventPublisherPort;
import com.vnshop.shippingservice.infrastructure.config.ShippingWebhookOutboxProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class ShippingWebhookOutboxRelay {
    private static final Logger LOG = LoggerFactory.getLogger(ShippingWebhookOutboxRelay.class);

    private final CarrierWebhookOutboxPort outbox;
    private final ShippingStatusEventPublisherPort eventPublisher;
    private final ShippingWebhookOutboxProperties properties;

    public ShippingWebhookOutboxRelay(
            CarrierWebhookOutboxPort outbox,
            ShippingStatusEventPublisherPort eventPublisher,
            ShippingWebhookOutboxProperties properties) {
        this.outbox = outbox;
        this.eventPublisher = eventPublisher;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${shipping.webhook-outbox.poll-interval-ms}")
    public void publishPending() {
        int recovered = outbox.recoverStaleClaims(Instant.now().minusMillis(properties.claimTimeoutMs()));
        if (recovered > 0) {
            LOG.warn("Recovered {} stale carrier webhook outbox claims", recovered);
        }
        List<CarrierWebhookOutboxRecord> pending = outbox.findPending(properties.batchSize());
        for (CarrierWebhookOutboxRecord record : pending) {
            if (outbox.claim(record.id())) {
                publish(record);
            }
        }
    }

    private void publish(CarrierWebhookOutboxRecord record) {
        try {
            eventPublisher.publishStatusUpdate(record.event())
                    .whenComplete((ignored, failure) -> complete(record, failure));
        } catch (RuntimeException failure) {
            complete(record, failure);
        }
    }

    private void complete(CarrierWebhookOutboxRecord record, Throwable failure) {
        if (failure == null) {
            outbox.markPublished(record.id());
            LOG.debug("Published carrier webhook event {} for {}", record.event().eventId(), record.event().carrier());
            return;
        }

        int attempts = record.attempts() + 1;
        boolean dead = attempts >= properties.maxAttempts();
        long exponentialBackoff = properties.initialBackoffSeconds()
                * (1L << Math.min(attempts, properties.backoffExponentCap()));
        long backoffSeconds = Math.min(exponentialBackoff, properties.maxBackoffSeconds());
        Instant nextRetryAt = dead ? null : Instant.now().plusSeconds(backoffSeconds);
        outbox.recordFailure(record.id(), attempts, nextRetryAt, dead, failure.getMessage());

        if (dead) {
            LOG.error("Carrier webhook event {} moved to FAILED after {} attempts",
                    record.event().eventId(), attempts, failure);
        } else {
            LOG.warn("Carrier webhook event {} publish failed; retry {} scheduled",
                    record.event().eventId(), attempts);
        }
    }
}
