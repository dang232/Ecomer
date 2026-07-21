package com.vnshop.shippingservice.domain.model;

import java.util.Objects;

/**
 * Canonical carrier event crossing the inbound webhook anti-corruption layer.
 */
public record CarrierWebhookEvent(
        String eventId,
        String orderId,
        String carrier,
        String trackingCode,
        String status,
        String statusText,
        String eventTimestamp
) {
    public CarrierWebhookEvent {
        eventId = requireNonBlank(eventId, "eventId");
        orderId = requireNonBlank(orderId, "orderId");
        carrier = requireNonBlank(carrier, "carrier");
        trackingCode = requireNonBlank(trackingCode, "trackingCode");
        status = requireNonBlank(status, "status");
        statusText = statusText == null ? "" : statusText;
    }

    private static String requireNonBlank(String value, String field) {
        Objects.requireNonNull(value, field + " is required");
        if (value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value;
    }
}
