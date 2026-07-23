package com.vnshop.shippingservice.infrastructure.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.domain.port.out.ShippingCancellationEventPublisherPort;
import com.vnshop.shippingservice.domain.port.out.ShippingStatusEventPublisherPort;
import com.vnshop.shippingservice.infrastructure.config.ShippingEventProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Component
public class ShippingEventPublisher implements ShippingCancellationEventPublisherPort, ShippingStatusEventPublisherPort {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final ShippingEventProperties properties;

    @Autowired
    public ShippingEventPublisher(
            KafkaTemplate<String, String> kafkaTemplate,
            ObjectMapper objectMapper,
            ShippingEventProperties properties) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    public ShippingEventPublisher(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this(kafkaTemplate, objectMapper,
                new ShippingEventProperties("shipping.cancelled", "shipping.status.updated",
                        "shipping.cod.collected"));
    }

    @Override
    public CompletableFuture<Void> publishCancelled(String orderId, String sagaId, String reason) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("orderId", orderId);
            payload.put("sagaId", sagaId == null ? "" : sagaId);
            payload.put("reason", reason);
            payload.put("timestamp", Instant.now().toString());
            return send(properties.cancelledTopic(), orderId, objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            return CompletableFuture.failedFuture(e);
        }
    }

    @Override
    public CompletableFuture<Void> publishStatusUpdate(CarrierWebhookEvent event) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("eventId", event.eventId());
            payload.put("orderId", event.orderId());
            payload.put("carrier", event.carrier());
            payload.put("trackingCode", event.trackingCode());
            payload.put("status", event.status());
            payload.put("statusText", event.statusText());
            payload.put("timestamp", event.eventTimestamp() == null
                    ? Instant.now().toString() : event.eventTimestamp());
            payload.put("eventTimestamp", Instant.now().toString());
            CompletableFuture<Void> statusFuture = send(
                    properties.statusUpdatedTopic(), event.orderId(), objectMapper.writeValueAsString(payload));
            if (!event.hasVerifiedCodCollection()) {
                return statusFuture;
            }
            return statusFuture.thenCompose(ignored -> publishCodCollected(event));
        } catch (Exception e) {
            return CompletableFuture.failedFuture(e);
        }
    }

    private CompletableFuture<Void> publishCodCollected(CarrierWebhookEvent event) {
        try {
            UUID orderId = UUID.fromString(event.orderId());
            long amount = event.collectedCodAmount().setScale(0).longValueExact();
            if (amount <= 0) {
                return CompletableFuture.completedFuture(null);
            }
            Instant collectedAt = Instant.parse(event.eventTimestamp());
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("collectionId", event.codCollectionId());
            payload.put("shipmentId", event.codShipmentId());
            payload.put("orderId", orderId);
            payload.put("carrier", event.carrier());
            payload.put("amount", amount);
            payload.put("currency", event.codCurrency().toUpperCase());
            payload.put("collectedAt", collectedAt.toString());

            Map<String, Object> envelope = new LinkedHashMap<>();
            envelope.put("eventId", event.codCollectionId());
            envelope.put("eventType", "SHIPPING_COD_COLLECTED");
            envelope.put("schemaVersion", 1);
            envelope.put("occurredAt", collectedAt.toString());
            envelope.put("producer", "shipping-service");
            envelope.put("aggregateId", event.codShipmentId());
            envelope.put("correlationId", orderId);
            envelope.put("causationId", UUID.nameUUIDFromBytes(
                    (event.carrier() + ":" + event.eventId()).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            envelope.put("payload", payload);
            return send(properties.codCollectedTopic(), event.orderId(), objectMapper.writeValueAsString(envelope));
        } catch (Exception exception) {
            return CompletableFuture.failedFuture(exception);
        }
    }

    private CompletableFuture<Void> send(String topic, String key, String payload) {
        return kafkaTemplate.send(topic, key, payload).thenApply(ignored -> null);
    }

}
