package com.vnshop.paymentservice.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Immutable value object representing a webhook that exhausted all retry attempts.
 */
public record WebhookDeadLetterRecord(
        UUID id,
        String webhookId,
        String provider,
        String eventType,
        String payload,
        String failureReason,
        int attempts,
        Instant createdAt,
        Instant retriedAt,
        int retryCount
) {}
