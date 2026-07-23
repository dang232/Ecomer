package com.vnshop.shippingservice.domain.model;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CodCollectionEvidenceTest {

    @Test
    void verifiesCarrierCollectionOnlyWhenExpectedAndCollectedAmountsMatch() {
        UUID shipmentId = UUID.randomUUID();
        UUID collectionId = UUID.randomUUID();
        CodCollectionEvidence expected = CodCollectionEvidence.expected(
                shipmentId, "ORDER-1", "GHN", "GHN-1", new BigDecimal("125000"), "VND");
        CarrierWebhookEvent event = new CarrierWebhookEvent(
                "carrier-event-1", "ORDER-1", "GHN", "GHN-1", "DELIVERED", "Delivered",
                "2026-07-24T10:05:00Z", new BigDecimal("125000"), collectionId.toString(), "VND");

        CodCollectionEvidence evidence = CodCollectionEvidence.fromCarrierEvent(event, expected);

        assertThat(evidence.status()).isEqualTo(CodCollectionEvidence.EvidenceStatus.VERIFIED);
        assertThat(evidence.collectionId()).isEqualTo(collectionId);
        assertThat(evidence.expectedCodAmount()).isEqualByComparingTo("125000");
        assertThat(evidence.collectedCodAmount()).isEqualByComparingTo("125000");
    }

    @Test
    void marksMissingOrMismatchedCollectionAsUnresolvedOrMismatched() {
        CodCollectionEvidence expected = CodCollectionEvidence.expected(
                UUID.randomUUID(), "ORDER-1", "GHN", "GHN-1", new BigDecimal("125000"), "VND");

        CodCollectionEvidence missing = CodCollectionEvidence.fromCarrierEvent(
                new CarrierWebhookEvent("carrier-event-2", "ORDER-1", "GHN", "GHN-1", "DELIVERED", "Delivered", null),
                expected);
        CodCollectionEvidence mismatch = CodCollectionEvidence.fromCarrierEvent(
                new CarrierWebhookEvent("carrier-event-3", "ORDER-1", "GHN", "GHN-1", "DELIVERED", "Delivered",
                        "2026-07-24T10:05:00Z", new BigDecimal("124999"), UUID.randomUUID().toString(), "VND"),
                expected);

        assertThat(missing.status()).isEqualTo(CodCollectionEvidence.EvidenceStatus.UNRESOLVED);
        assertThat(mismatch.status()).isEqualTo(CodCollectionEvidence.EvidenceStatus.MISMATCHED);
    }
}
