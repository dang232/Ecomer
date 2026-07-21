package com.vnshop.shippingservice.domain.port.out;

import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.domain.model.CarrierWebhookOutboxRecord;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface CarrierWebhookOutboxPort {
    boolean accept(CarrierWebhookEvent event);

    List<CarrierWebhookOutboxRecord> findPending(int batchSize);

    boolean claim(UUID id);

    /**
     * Requeues rows whose relay owner disappeared before publishing completed.
     */
    int recoverStaleClaims(Instant cutoff);

    void markPublished(UUID id);

    void recordFailure(UUID id, int attempts, Instant nextRetryAt, boolean dead, String error);
}
