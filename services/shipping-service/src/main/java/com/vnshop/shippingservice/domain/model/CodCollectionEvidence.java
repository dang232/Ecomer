package com.vnshop.shippingservice.domain.model;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;

/** Shipping-owned evidence used to decide whether a COD amount was collected. */
public record CodCollectionEvidence(
        UUID evidenceId,
        UUID shipmentId,
        UUID collectionId,
        String carrierEventId,
        String orderId,
        String carrier,
        String trackingCode,
        BigDecimal expectedCodAmount,
        BigDecimal collectedCodAmount,
        String currency,
        Instant providerTimestamp,
        EvidenceStatus status
) {
    public enum EvidenceStatus { EXPECTED, VERIFIED, UNRESOLVED, MISMATCHED }

    public CodCollectionEvidence {
        if (evidenceId == null || shipmentId == null) throw new IllegalArgumentException("evidence ids are required");
        if (orderId == null || orderId.isBlank()) throw new IllegalArgumentException("orderId is required");
        if (carrier == null || carrier.isBlank()) throw new IllegalArgumentException("carrier is required");
        if (trackingCode == null || trackingCode.isBlank()) throw new IllegalArgumentException("trackingCode is required");
        if (currency == null || currency.isBlank()) throw new IllegalArgumentException("currency is required");
        if (status == null) throw new IllegalArgumentException("status is required");
    }

    public static CodCollectionEvidence expected(
            UUID shipmentId,
            String orderId,
            String carrier,
            String trackingCode,
            BigDecimal expectedAmount,
            String currency) {
        return new CodCollectionEvidence(
                UUID.randomUUID(), shipmentId, null, null, orderId, carrier, trackingCode,
                expectedAmount, null, currency.toUpperCase(), null, EvidenceStatus.EXPECTED);
    }

    public static CodCollectionEvidence fromCarrierEvent(
            CarrierWebhookEvent event,
            CodCollectionEvidence expected) {
        UUID shipmentId = expected == null ? deterministicId("shipment:" + event.carrier() + ":" + event.trackingCode())
                : expected.shipmentId();
        UUID collectionId = parseOrDeterministic(event.codCollectionReference(),
                "collection:" + event.carrier() + ":" + event.eventId());
        Instant providerTimestamp = parseInstant(event.eventTimestamp());
        BigDecimal expectedAmount = expected == null ? null : expected.expectedCodAmount();
        String currency = event.codCurrency() == null || event.codCurrency().isBlank()
                ? (expected == null ? "VND" : expected.currency()) : event.codCurrency().toUpperCase();
        EvidenceStatus status = determineStatus(expectedAmount, event.collectedCodAmount(), providerTimestamp,
                currency, expected == null ? null : expected.currency());
        return new CodCollectionEvidence(
                deterministicId("evidence:" + event.carrier() + ":" + event.eventId()), shipmentId, collectionId,
                event.eventId(), event.orderId(), event.carrier(), event.trackingCode(), expectedAmount,
                event.collectedCodAmount(), currency, providerTimestamp, status);
    }

    private static EvidenceStatus determineStatus(
            BigDecimal expected,
            BigDecimal collected,
            Instant timestamp,
            String currency,
            String expectedCurrency) {
        if (expected == null || collected == null || timestamp == null
                || expectedCurrency == null || !expectedCurrency.equalsIgnoreCase(currency)) {
            return EvidenceStatus.UNRESOLVED;
        }
        return expected.compareTo(collected) == 0 ? EvidenceStatus.VERIFIED : EvidenceStatus.MISMATCHED;
    }

    private static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) return null;
        try { return Instant.parse(value); } catch (RuntimeException ignored) { return null; }
    }

    private static UUID parseOrDeterministic(String value, String fallback) {
        if (value != null && !value.isBlank()) {
            try { return UUID.fromString(value); } catch (IllegalArgumentException ignored) { }
        }
        return deterministicId(fallback);
    }

    private static UUID deterministicId(String value) {
        return UUID.nameUUIDFromBytes(value.getBytes(StandardCharsets.UTF_8));
    }
}
