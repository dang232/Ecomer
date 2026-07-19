package com.vnshop.shippingservice.application;

import com.vnshop.shippingservice.domain.port.out.ShippingEventPublisherPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CancelShipmentUseCaseTest {

    @Mock
    private ShippingEventPublisherPort shippingEventPublisher;

    @InjectMocks
    private CancelShipmentUseCase cancelShipmentUseCase;

    @Test
    void cancel_publishesShippingCancelledEvent() {
        cancelShipmentUseCase.cancel("order-123", "saga-456", "SAGA_COMPENSATION");
        verify(shippingEventPublisher).publishCancelled("order-123", "saga-456", "SAGA_COMPENSATION");
    }

    @Test
    void cancel_withNullSagaId_publishesEvent() {
        cancelShipmentUseCase.cancel("order-789", null, "ADMIN_CANCEL");
        verify(shippingEventPublisher).publishCancelled("order-789", null, "ADMIN_CANCEL");
    }
}
