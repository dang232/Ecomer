package com.vnshop.shippingservice.infrastructure.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.shippingservice.domain.port.out.ShippingEventPublisherPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Component
public class ShippingEventPublisher implements ShippingEventPublisherPort {

    private static final Logger LOG = LoggerFactory.getLogger(ShippingEventPublisher.class);
    private static final String TOPIC_CANCELLED = "shipping.cancelled";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public ShippingEventPublisher(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void publishCancelled(String orderId, String sagaId, String reason) {
        try {
            Map<String, Object> payload = Map.of(
                "orderId", orderId,
                "sagaId", sagaId != null ? sagaId : "",
                "reason", reason,
                "timestamp", Instant.now().toString()
            );
            kafkaTemplate.send(TOPIC_CANCELLED, orderId, objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            LOG.warn("Failed to publish shipping.cancelled for order {}", orderId, e);
        }
    }
}
