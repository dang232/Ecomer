package com.vnshop.paymentservice.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public record FinancialEventOutboxRecord(
        Long id,
        UUID eventId,
        String eventType,
        String aggregateId,
        String payload,
        Instant createdAt,
        Instant publishedAt,
        int attemptCount,
        Instant nextAttemptAt,
        String lastError,
        boolean dead) {

    public FinancialEventOutboxRecord {
        Objects.requireNonNull(eventId, "eventId is required");
        requireNonBlank(eventType, "eventType");
        requireNonBlank(aggregateId, "aggregateId");
        requireNonBlank(payload, "payload");
        Objects.requireNonNull(createdAt, "createdAt is required");
        if (attemptCount < 0) {
            throw new IllegalArgumentException("attemptCount must not be negative");
        }
    }

    public static FinancialEventOutboxRecord pending(UUID eventId, String eventType,
                                                     String aggregateId, String payload) {
        return new FinancialEventOutboxRecord(null, eventId, eventType, aggregateId, payload,
                Instant.now(), null, 0, null, null, false);
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
