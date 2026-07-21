package com.vnshop.shippingservice.domain.port.out;

import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;

import java.util.concurrent.CompletableFuture;

public interface ShippingStatusEventPublisherPort {
    CompletableFuture<Void> publishStatusUpdate(CarrierWebhookEvent event);
}
