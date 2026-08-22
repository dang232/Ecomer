package com.vnshop.shippingservice.application;

import com.vnshop.shippingservice.domain.port.out.ShippingCancellationEventPublisherPort;
import com.vnshop.shippingservice.domain.port.out.CarrierGatewayPort;
import com.vnshop.shippingservice.domain.port.out.ShippingLabelRepositoryPort;
import java.util.concurrent.CompletionException;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CancelShipmentUseCase {

    private static final Logger LOG = LoggerFactory.getLogger(CancelShipmentUseCase.class);
    private final ShippingCancellationEventPublisherPort shippingEventPublisher;
    private final CarrierGatewayPort carrierGateway;
    private final ShippingLabelRepositoryPort shippingLabelRepository;

    public CancelShipmentUseCase(ShippingCancellationEventPublisherPort shippingEventPublisher) {
        this(shippingEventPublisher, null, ShippingLabelRepositoryPort.noop());
    }

    @Autowired
    public CancelShipmentUseCase(
            ShippingCancellationEventPublisherPort shippingEventPublisher,
            CarrierGatewayPort carrierGateway,
            ShippingLabelRepositoryPort shippingLabelRepository) {
        this.shippingEventPublisher = shippingEventPublisher;
        this.carrierGateway = carrierGateway;
        this.shippingLabelRepository = shippingLabelRepository;
    }

    @Transactional
    public void cancel(String orderId, String sagaId, String reason) {
        LOG.info("Cancelling shipment for order {} (reason: {})", orderId, reason);
        try {
            if (carrierGateway != null) {
                for (var label : shippingLabelRepository.findCreatedByOrderId(orderId)) {
                    carrierGateway.cancelLabel(
                            com.vnshop.shippingservice.domain.model.CarrierCode.valueOf(label.carrier().name()),
                            label.trackingCode());
                    shippingLabelRepository.markCancelled(orderId, label.trackingCode());
                }
            }
            shippingEventPublisher.publishCancelled(orderId, sagaId, reason).join();
        } catch (CompletionException e) {
            throw new IllegalStateException("Shipping cancellation was not acknowledged for order " + orderId, e.getCause());
        }
    }
}
