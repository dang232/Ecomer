package com.vnshop.shippingservice.application;

import com.vnshop.shippingservice.domain.port.out.ShippingCancellationEventPublisherPort;
import com.vnshop.shippingservice.domain.model.CarrierCode;
import com.vnshop.shippingservice.domain.model.ShippingLabelRecord;
import com.vnshop.shippingservice.domain.port.out.CarrierGatewayPort;
import com.vnshop.shippingservice.domain.port.out.ShippingLabelRepositoryPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
class CancelShipmentUseCaseTest {

    @Mock
    private ShippingCancellationEventPublisherPort shippingEventPublisher;

    @Mock
    private CarrierGatewayPort carrierGateway;

    @Mock
    private ShippingLabelRepositoryPort shippingLabelRepository;

    @InjectMocks
    private CancelShipmentUseCase cancelShipmentUseCase;

    @Test
    void cancel_publishesShippingCancelledEvent() {
        when(shippingEventPublisher.publishCancelled("order-123", "saga-456", "SAGA_COMPENSATION"))
                .thenReturn(CompletableFuture.completedFuture(null));
        cancelShipmentUseCase.cancel("order-123", "saga-456", "SAGA_COMPENSATION");
        verify(shippingEventPublisher).publishCancelled("order-123", "saga-456", "SAGA_COMPENSATION");
    }

    @Test
    void cancel_withNullSagaId_publishesEvent() {
        when(shippingEventPublisher.publishCancelled("order-789", null, "ADMIN_CANCEL"))
                .thenReturn(CompletableFuture.completedFuture(null));
        cancelShipmentUseCase.cancel("order-789", null, "ADMIN_CANCEL");
        verify(shippingEventPublisher).publishCancelled("order-789", null, "ADMIN_CANCEL");
    }

    @Test
    void cancel_failsWhenKafkaDoesNotAcknowledgeCancellation() {
        when(shippingEventPublisher.publishCancelled("order-123", "saga-456", "SAGA_COMPENSATION"))
                .thenReturn(CompletableFuture.failedFuture(new IllegalStateException("broker unavailable")));

        assertThrows(IllegalStateException.class,
                () -> cancelShipmentUseCase.cancel("order-123", "saga-456", "SAGA_COMPENSATION"));
    }

    @Test
    void cancelCancelsCreatedLabelsBeforePublishingConfirmation() {
        CancelShipmentUseCase useCase = new CancelShipmentUseCase(
                shippingEventPublisher, carrierGateway, shippingLabelRepository);
        ShippingLabelRecord label = new ShippingLabelRecord(
                java.util.UUID.randomUUID(), "order-123", CarrierCode.GHN, "GHN-1",
                ShippingLabelRecord.Status.CREATED);
        when(shippingLabelRepository.findCreatedByOrderId("order-123")).thenReturn(java.util.List.of(label));
        when(shippingEventPublisher.publishCancelled("order-123", "saga-456", "SAGA_COMPENSATION"))
                .thenReturn(CompletableFuture.completedFuture(null));

        useCase.cancel("order-123", "saga-456", "SAGA_COMPENSATION");

        verify(carrierGateway).cancelLabel(CarrierCode.GHN, "GHN-1");
        verify(shippingLabelRepository).markCancelled("order-123", "GHN-1");
        verify(shippingEventPublisher).publishCancelled("order-123", "saga-456", "SAGA_COMPENSATION");
    }

    @Test
    void cancelDoesNotConfirmWhenCarrierCancellationFails() {
        CancelShipmentUseCase useCase = new CancelShipmentUseCase(
                shippingEventPublisher, carrierGateway, shippingLabelRepository);
        ShippingLabelRecord label = new ShippingLabelRecord(
                java.util.UUID.randomUUID(), "order-123", CarrierCode.GHN, "GHN-1",
                ShippingLabelRecord.Status.CREATED);
        when(shippingLabelRepository.findCreatedByOrderId("order-123")).thenReturn(java.util.List.of(label));
        org.mockito.Mockito.doThrow(new IllegalStateException("carrier unavailable"))
                .when(carrierGateway).cancelLabel(CarrierCode.GHN, "GHN-1");

        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,
                () -> useCase.cancel("order-123", "saga-456", "SAGA_COMPENSATION"));

        verify(shippingLabelRepository, never()).markCancelled("order-123", "GHN-1");
        verify(shippingEventPublisher, never()).publishCancelled("order-123", "saga-456", "SAGA_COMPENSATION");
    }
}
