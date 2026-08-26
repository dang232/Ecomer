package com.vnshop.paymentservice.infrastructure.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.application.ConfirmCodCollectionUseCase;
import com.vnshop.paymentservice.infrastructure.dlt.DurableDltService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class CodCollectedListenerTest {

    @Test
    void mapsVersionOneEnvelopeIntoCollectionConfirmation() {
        ConfirmCodCollectionUseCase useCase = mock(ConfirmCodCollectionUseCase.class);
        CodCollectedListener listener = new CodCollectedListener(useCase, new ObjectMapper(), mock(DurableDltService.class));
        UUID collectionId = UUID.randomUUID();
        UUID shipmentId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();

        listener.onCodCollected("""
                {"eventId":"%s","eventType":"SHIPPING_COD_COLLECTED","schemaVersion":1,
                 "occurredAt":"2026-07-24T10:05:00Z","producer":"shipping-service",
                 "aggregateId":"%s","correlationId":"%s","causationId":"%s",
                 "payload":{"collectionId":"%s","shipmentId":"%s","orderId":"%s",
                 "carrier":"GHN","amount":125000,"currency":"VND","collectedAt":"2026-07-24T10:05:00Z"}}
                """.formatted(UUID.randomUUID(), shipmentId, orderId, collectionId,
                collectionId, shipmentId, orderId));

        verify(useCase).confirm(argThat(command ->
                command.collectionId().equals(collectionId)
                        && command.shipmentId().equals(shipmentId)
                        && command.orderId().equals(orderId.toString())
                        && command.amount().compareTo(new BigDecimal("125000")) == 0
                        && command.currency().equals("VND")
                        && command.collectedAt().equals(Instant.parse("2026-07-24T10:05:00Z"))));
    }

    @Test
    void ignoresUnknownSchemaVersionWithoutMutatingPayment() {
        ConfirmCodCollectionUseCase useCase = mock(ConfirmCodCollectionUseCase.class);
        CodCollectedListener listener = new CodCollectedListener(useCase, new ObjectMapper(), mock(DurableDltService.class));

        listener.onCodCollected("""
                {"eventType":"SHIPPING_COD_COLLECTED","schemaVersion":2,
                 "payload":{"collectionId":"%s","orderId":"%s","amount":125000,"currency":"VND"}}
                """.formatted(UUID.randomUUID(), UUID.randomUUID()));

        verify(useCase, never()).confirm(org.mockito.ArgumentMatchers.any());
    }
}
