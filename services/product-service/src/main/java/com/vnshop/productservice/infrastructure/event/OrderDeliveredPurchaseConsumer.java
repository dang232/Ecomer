package com.vnshop.productservice.infrastructure.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.productservice.domain.review.port.out.PurchaseVerificationPort;
import java.time.Instant;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Builds local purchase evidence from the order service's durable outbox event. */
@Service
@ConditionalOnProperty(name = "review.purchase-events.enabled", havingValue = "true", matchIfMissing = true)
public class OrderDeliveredPurchaseConsumer {
    private static final Logger LOGGER = LoggerFactory.getLogger(OrderDeliveredPurchaseConsumer.class);

    private final ObjectMapper objectMapper;
    private final PurchaseVerificationPort purchaseVerification;

    public OrderDeliveredPurchaseConsumer(ObjectMapper objectMapper, PurchaseVerificationPort purchaseVerification) {
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is required");
        this.purchaseVerification = Objects.requireNonNull(purchaseVerification, "purchaseVerification is required");
    }

    @KafkaListener(
            topics = "${review.purchase-events.topic:order.delivered}",
            groupId = "${review.purchase-events.group-id:product-service-review-purchases}")
    @Transactional
    public void consume(String rawEvent) {
        JsonNode envelope = readTree(rawEvent, "outbox envelope");
        if (!"ORDER_DELIVERED".equals(text(envelope, "eventType"))) {
            return;
        }

        JsonNode payload = envelope.path("payload");
        if (payload.isTextual()) {
            payload = readTree(payload.textValue(), "order.delivered payload");
        }

        String orderId = firstNonBlank(text(payload, "orderId"), text(envelope, "aggregateId"));
        String buyerId = text(payload, "buyerId");
        JsonNode items = payload.path("items");
        if (orderId == null || buyerId == null || !items.isArray()) {
            throw new IllegalArgumentException("order.delivered event is missing orderId, buyerId, or items");
        }

        Instant deliveredAt = Instant.now();
        for (JsonNode item : items) {
            String productId = text(item, "productId");
            if (productId == null) {
                throw new IllegalArgumentException("order.delivered item is missing productId");
            }
            purchaseVerification.recordDeliveredPurchase(orderId, buyerId, productId, deliveredAt);
        }
        LOGGER.debug("Recorded delivered purchase evidence for order {} buyer {}", orderId, buyerId);
    }

    private JsonNode readTree(String raw, String description) {
        try {
            return objectMapper.readTree(raw);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Invalid " + description, exception);
        }
    }

    private static String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String value = node.path(field).asText(null);
        return value == null || value.isBlank() ? null : value;
    }

    private static String firstNonBlank(String first, String second) {
        return first != null ? first : second;
    }
}
