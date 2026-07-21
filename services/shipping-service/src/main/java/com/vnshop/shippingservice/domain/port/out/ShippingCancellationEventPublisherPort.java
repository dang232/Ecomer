package com.vnshop.shippingservice.domain.port.out;

import java.util.concurrent.CompletableFuture;

public interface ShippingCancellationEventPublisherPort {
    CompletableFuture<Void> publishCancelled(String orderId, String sagaId, String reason);
}
