package com.vnshop.shippingservice.application;

import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.domain.port.out.CarrierWebhookOutboxPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

/**
 * Accepts an already authenticated and normalized carrier event.
 *
 * <p>The durable outbox insert is the acknowledgement boundary. Kafka is
 * deliberately outside the HTTP request path and is handled by the relay.</p>
 */
@Service
public class ReceiveCarrierWebhookUseCase {
    private final CarrierWebhookOutboxPort outbox;

    public ReceiveCarrierWebhookUseCase(CarrierWebhookOutboxPort outbox) {
        this.outbox = Objects.requireNonNull(outbox, "outbox is required");
    }

    @Transactional
    public Result receive(CarrierWebhookEvent event) {
        return outbox.accept(event) ? Result.ACCEPTED : Result.DUPLICATE;
    }

    public enum Result {
        ACCEPTED,
        DUPLICATE
    }
}
