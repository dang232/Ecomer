package com.vnshop.shippingservice.infrastructure.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.domain.port.out.ShippingCancellationEventPublisherPort;
import com.vnshop.shippingservice.domain.port.out.ShippingStatusEventPublisherPort;
import com.vnshop.shippingservice.infrastructure.config.ShippingEventProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Component
public class ShippingEventPublisher implements ShippingCancellationEventPublisherPort, ShippingStatusEventPublisherPort {

    private static final Logger LOG = LoggerFactory.getLogger(ShippingEventPublisher.class);

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
                new ShippingEventProperties("shipping.cancelled", "shipping.status.updated"));
    }

    @Override
    public void publishCancelled(String orderId, String sagaId, String reason) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("orderId", orderId);
            payload.put("sagaId", sagaId == null ? "" : sagaId);
            payload.put("reason", reason);
            payload.put("timestamp", Instant.now().toString());
            send(properties.cancelledTopic(), orderId, objectMapper.writeValueAsString(payload))
                    .whenComplete((ignored, failure) -> logResult(properties.cancelledTopic(), orderId, failure));
        } catch (Exception e) {
            LOG.error("Unable to enqueue {} for order {}", properties.cancelledTopic(), orderId, e);
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
            return send(properties.statusUpdatedTopic(), event.orderId(), objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            return CompletableFuture.failedFuture(e);
        }
    }

    private CompletableFuture<Void> send(String topic, String key, String payload) {
        return kafkaTemplate.send(topic, key, payload).thenApply(ignored -> null);
    }

    private void logResult(String topic, String orderId, Throwable failure) {
        if (failure == null) {
            LOG.debug("Kafka acknowledged {} for order {}", topic, orderId);
        } else {
            LOG.error("Kafka publish failed for {} and order {}", topic, orderId, failure);
        }
    }
}
