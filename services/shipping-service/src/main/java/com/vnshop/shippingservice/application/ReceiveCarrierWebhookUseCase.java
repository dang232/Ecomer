package com.vnshop.shippingservice.application;

import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.domain.model.CodCollectionEvidence;
import com.vnshop.shippingservice.domain.port.out.CarrierWebhookOutboxPort;
import com.vnshop.shippingservice.domain.port.out.CodCollectionEvidencePort;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final CodCollectionEvidencePort codCollectionEvidence;

    public ReceiveCarrierWebhookUseCase(CarrierWebhookOutboxPort outbox) {
        this(outbox, CodCollectionEvidencePort.noop());
    }

    @Autowired
    public ReceiveCarrierWebhookUseCase(
            CarrierWebhookOutboxPort outbox,
            CodCollectionEvidencePort codCollectionEvidence) {
        this.outbox = Objects.requireNonNull(outbox, "outbox is required");
        this.codCollectionEvidence = Objects.requireNonNull(codCollectionEvidence, "codCollectionEvidence is required");
    }

    @Transactional
    public Result receive(CarrierWebhookEvent event) {
        CodCollectionEvidence expected = codCollectionEvidence
                .findExpected(event.carrier(), event.trackingCode())
                .orElse(null);
        CodCollectionEvidence evidence = CodCollectionEvidence.fromCarrierEvent(event, expected);
        CarrierWebhookEvent enriched = event.withCodEvidence(evidence);
        if (!outbox.accept(enriched)) {
            return Result.DUPLICATE;
        }
        codCollectionEvidence.saveCollected(evidence);
        return Result.ACCEPTED;
    }

    public enum Result {
        ACCEPTED,
        DUPLICATE
    }
}
