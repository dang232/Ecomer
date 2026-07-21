package com.vnshop.shippingservice.domain.port.out;

public interface ShippingCancellationEventPublisherPort {
    void publishCancelled(String orderId, String sagaId, String reason);
}
