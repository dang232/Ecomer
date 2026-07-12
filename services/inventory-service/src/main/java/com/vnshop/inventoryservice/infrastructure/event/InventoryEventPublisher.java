package com.vnshop.inventoryservice.infrastructure.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.inventoryservice.domain.port.out.InventoryEventPublisherPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Component
public class InventoryEventPublisher implements InventoryEventPublisherPort {

    private static final Logger LOG = LoggerFactory.getLogger(InventoryEventPublisher.class);
    private static final String TOPIC_RELEASED = "inventory.released";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public InventoryEventPublisher(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void publishReleased(String orderId, String sagaId, List<ReleasedItem> items) {
        try {
            Map<String, Object> payload = Map.of(
                "orderId", orderId,
                "sagaId", sagaId != null ? sagaId : "",
                "releasedItems", items,
                "timestamp", Instant.now().toString()
            );
            kafkaTemplate.send(TOPIC_RELEASED, orderId, objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            LOG.warn("Failed to publish inventory.released for order {}", orderId, e);
        }
    }
}
