package com.vnshop.shippingservice.application;

import com.vnshop.shippingservice.domain.port.out.ShippingCancellationEventPublisherPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CancelShipmentUseCaseTest {

    @Mock
    private ShippingCancellationEventPublisherPort shippingEventPublisher;

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
}
