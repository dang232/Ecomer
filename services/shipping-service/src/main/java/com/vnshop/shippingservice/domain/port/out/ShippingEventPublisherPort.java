package com.vnshop.shippingservice.domain.port.out;

public interface ShippingEventPublisherPort {
    void publishCancelled(String orderId, String sagaId, String reason);
}
