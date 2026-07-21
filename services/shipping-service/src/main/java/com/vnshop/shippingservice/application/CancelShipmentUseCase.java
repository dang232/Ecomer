package com.vnshop.shippingservice.application;

import com.vnshop.shippingservice.domain.port.out.ShippingCancellationEventPublisherPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CancelShipmentUseCase {

    private static final Logger LOG = LoggerFactory.getLogger(CancelShipmentUseCase.class);
    private final ShippingCancellationEventPublisherPort shippingEventPublisher;

    public CancelShipmentUseCase(ShippingCancellationEventPublisherPort shippingEventPublisher) {
        this.shippingEventPublisher = shippingEventPublisher;
    }

    @Transactional
    public void cancel(String orderId, String sagaId, String reason) {
        // TODO: Add shipment lookup and status update when shipment repository is available
        LOG.info("Cancelling shipment for order {} (reason: {})", orderId, reason);
        shippingEventPublisher.publishCancelled(orderId, sagaId, reason);
    }
}
