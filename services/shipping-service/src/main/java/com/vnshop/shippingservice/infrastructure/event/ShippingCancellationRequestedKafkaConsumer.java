package com.vnshop.shippingservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.shippingservice.application.CancelShipmentUseCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class ShippingCancellationRequestedKafkaConsumer {
    private static final Logger LOG = LoggerFactory.getLogger(ShippingCancellationRequestedKafkaConsumer.class);

    private final CancelShipmentUseCase cancelShipmentUseCase;
    private final ObjectMapper objectMapper;

    public ShippingCancellationRequestedKafkaConsumer(
            CancelShipmentUseCase cancelShipmentUseCase,
            ObjectMapper objectMapper) {
        this.cancelShipmentUseCase = cancelShipmentUseCase;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "shipping.cancel-requested", groupId = "shipping-svc-cancel")
    public void onCancellationRequested(String message) {
        try {
            JsonNode node = objectMapper.readTree(message);
            String orderId = requiredText(node, "orderId");
            String sagaId = requiredText(node, "sagaId");
            String reason = node.path("reason").asText("order-compensation");
            cancelShipmentUseCase.cancel(orderId, sagaId, reason);
        } catch (Exception exception) {
            LOG.error("Failed to process shipping.cancel-requested message", exception);
            throw new IllegalStateException("shipping.cancel-requested processing failed", exception);
        }
    }

    private static String requiredText(JsonNode node, String field) {
        String value = node.path(field).asText();
        if (value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value;
    }
}
