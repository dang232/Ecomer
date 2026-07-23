package com.vnshop.shippingservice.domain.model;

import java.math.BigDecimal;
import java.util.UUID;
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
        String eventTimestamp,
        BigDecimal collectedCodAmount,
        String codCollectionReference,
        String codCurrency,
        BigDecimal expectedCodAmount,
        UUID codShipmentId,
        UUID codCollectionId,
        String codEvidenceStatus
) {
    public CarrierWebhookEvent(
            String eventId,
            String orderId,
            String carrier,
            String trackingCode,
            String status,
            String statusText,
            String eventTimestamp) {
        this(eventId, orderId, carrier, trackingCode, status, statusText, eventTimestamp,
                null, null, null, null, null, null, null);
    }

    public CarrierWebhookEvent(
            String eventId,
            String orderId,
            String carrier,
            String trackingCode,
            String status,
            String statusText,
            String eventTimestamp,
            BigDecimal collectedCodAmount,
            String codCollectionReference,
            String codCurrency) {
        this(eventId, orderId, carrier, trackingCode, status, statusText, eventTimestamp,
                collectedCodAmount, codCollectionReference, codCurrency, null, null, null, null);
    }

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

    public CarrierWebhookEvent withCodEvidence(CodCollectionEvidence evidence) {
        Objects.requireNonNull(evidence, "evidence is required");
        return new CarrierWebhookEvent(
                eventId, orderId, carrier, trackingCode, status, statusText, eventTimestamp,
                collectedCodAmount, codCollectionReference, evidence.currency(),
                evidence.expectedCodAmount(), evidence.shipmentId(), evidence.collectionId(),
                evidence.status().name());
    }

    public boolean hasVerifiedCodCollection() {
        return "VERIFIED".equals(codEvidenceStatus)
                && codShipmentId != null
                && codCollectionId != null
                && expectedCodAmount != null
                && collectedCodAmount != null
                && codCurrency != null
                && eventTimestamp != null
                && !eventTimestamp.isBlank();
    }
}
