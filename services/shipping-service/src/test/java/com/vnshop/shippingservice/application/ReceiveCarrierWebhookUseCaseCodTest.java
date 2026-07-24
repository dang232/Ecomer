package com.vnshop.shippingservice.application;

import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.domain.model.CodCollectionEvidence;
import com.vnshop.shippingservice.domain.port.out.CarrierWebhookOutboxPort;
import com.vnshop.shippingservice.domain.port.out.CodCollectionEvidencePort;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReceiveCarrierWebhookUseCaseCodTest {

    @Test
    void storesVerifiedEvidenceOnTheDurableWebhookEvent() {
        CarrierWebhookOutboxPort outbox = mock(CarrierWebhookOutboxPort.class);
        CodCollectionEvidencePort evidencePort = mock(CodCollectionEvidencePort.class);
        CodCollectionEvidence expected = CodCollectionEvidence.expected(
                UUID.randomUUID(), "ORDER-1", "GHN", "GHN-1", new BigDecimal("125000"), "VND");
        when(evidencePort.findExpected("GHN", "GHN-1")).thenReturn(Optional.of(expected));
        when(outbox.accept(any())).thenReturn(true);
        ReceiveCarrierWebhookUseCase useCase = new ReceiveCarrierWebhookUseCase(outbox, evidencePort);

        ReceiveCarrierWebhookUseCase.Result result = useCase.receive(new CarrierWebhookEvent(
                "event-1", "ORDER-1", "GHN", "GHN-1", "DELIVERED", "Delivered",
                "2026-07-24T10:05:00Z", new BigDecimal("125000"), UUID.randomUUID().toString(), "VND"));

        assertThat(result).isEqualTo(ReceiveCarrierWebhookUseCase.Result.ACCEPTED);
        verify(evidencePort).saveCollected(any(CodCollectionEvidence.class));
    }

    @Test
    void persistsUnresolvedCarrierStatusWithoutTreatingDeliveryAsCollection() {
        CarrierWebhookOutboxPort outbox = mock(CarrierWebhookOutboxPort.class);
        CodCollectionEvidencePort evidencePort = mock(CodCollectionEvidencePort.class);
        when(evidencePort.findExpected("GHN", "GHN-1")).thenReturn(Optional.empty());
        when(outbox.accept(any())).thenReturn(true);
        ReceiveCarrierWebhookUseCase useCase = new ReceiveCarrierWebhookUseCase(outbox, evidencePort);

        useCase.receive(new CarrierWebhookEvent(
                "event-2", "ORDER-1", "GHN", "GHN-1", "DELIVERED", "Delivered", null));

        verify(evidencePort).saveCollected(org.mockito.ArgumentMatchers.argThat(evidence ->
                evidence.status() == CodCollectionEvidence.EvidenceStatus.UNRESOLVED));
    }
}
