package com.vnshop.shippingservice.domain.model;

import java.time.Instant;
import java.util.UUID;

public record CarrierWebhookOutboxRecord(
        UUID id,
        CarrierWebhookEvent event,
        int attempts,
        Instant nextRetryAt
) {
}
