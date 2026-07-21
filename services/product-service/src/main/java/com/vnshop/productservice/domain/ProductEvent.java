package com.vnshop.productservice.domain;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public record ProductEvent(
        String productId,
        EventType eventType,
        Instant timestamp,
        Map<String, Object> payload,
        String eventId
) {
    public ProductEvent {
        requireNonBlank(productId, "productId");
        Objects.requireNonNull(eventType, "eventType is required");
        timestamp = timestamp == null ? Instant.now() : timestamp;
        payload = payload == null ? Map.of() : Map.copyOf(payload);
        eventId = eventId == null || eventId.isBlank() ? UUID.randomUUID().toString() : eventId;
    }

    public ProductEvent(String productId, EventType eventType, Instant timestamp, Map<String, Object> payload) {
        this(productId, eventType, timestamp, payload, null);
    }

    public enum EventType {
        CREATED,
        UPDATED,
        DELETED,
        STOCK_CHANGED
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
