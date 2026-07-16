package com.vnshop.orderservice.infrastructure.event.projection;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.port.out.ProjectionPort;
import java.math.BigDecimal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.stereotype.Service;

@Service
public class OrderProjectionListener {
    private static final Logger LOG = LoggerFactory.getLogger(OrderProjectionListener.class);

    private final ProjectionPort projectionPort;
    private final ObjectMapper objectMapper;

    public OrderProjectionListener(ProjectionPort projectionPort, ObjectMapper objectMapper) {
        this.projectionPort = projectionPort;
        this.objectMapper = objectMapper;
    }

    @RetryableTopic(
            attempts = "3",
            dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = ".DLT",
            retryTopicSuffix = ".retry"
    )
    @KafkaListener(
            topics = {"order.created", "order.updated", "order.paid", "order.shipped", "order.cancelled"},
            groupId = "order-service-projection",
            concurrency = "6"
    )
    public void onOrderEvent(String eventJson) {
        JsonNode envelope = readTree(eventJson);
        JsonNode payload = envelope.hasNonNull("payload") ? readTree(envelope.get("payload").asText()) : envelope;

        String orderId = text(payload, "orderId");
        if (orderId == null || orderId.isBlank()) {
            LOG.warn("Skipping projection update — missing orderId in event payload");
            return;
        }

        String eventType = textOrDefault(payload, "eventType", text(envelope, "eventType"));
        String status = projectStatus(eventType, payload);
        String buyerId = text(payload, "buyerId");

        BigDecimal totalAmount = totalAmount(payload);
        String firstSellerId = firstSellerId(payload);
        int itemCount = itemCount(payload);

        projectionPort.upsertOrderSummary(orderId, status, buyerId, firstSellerId, totalAmount, itemCount);
        LOG.debug("Projected {} for order {} (status={})", eventType, orderId, status);
    }

    private static String projectStatus(String eventType, JsonNode payload) {
        String fulfillmentStatus = normalizedStatus(text(payload, "fulfillmentStatus"));
        if (fulfillmentStatus != null) return fulfillmentStatus;

        String legacyStatus = normalizedStatus(text(payload, "status"));
        if (legacyStatus != null) return legacyStatus;

        String legacyEventStatus = normalizedStatus(eventType);
        return legacyEventStatus == null ? "PENDING" : legacyEventStatus;
    }

    private static String normalizedStatus(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim().toUpperCase();
        if (value.contains("CANCEL") || value.contains("REJECT")) return "CANCELLED";
        if (value.contains("PENDING") || value.contains("CREATED")) return "PENDING";
        if (value.contains("DELIVER")) return "DELIVERED";
        if (value.contains("SHIP")) return "SHIPPED";
        if (value.contains("ACCEPT") || value.contains("PACK") || value.contains("CONFIRM")) {
            return "CONFIRMED";
        }
        return null;
    }

    private static BigDecimal totalAmount(JsonNode payload) {
        JsonNode value = payload.path("totalAmount");
        if (value.isNumber()) return value.decimalValue();
        if (value.isObject() && value.path("amount").isNumber()) {
            return value.path("amount").decimalValue();
        }
        return sumSellerTotals(payload);
    }

    private static int itemCount(JsonNode payload) {
        JsonNode value = payload.path("itemCount");
        if (value.isNumber()) return value.asInt(0);

        int count = 0;
        for (JsonNode item : payload.path("items")) {
            count += item.path("quantity").asInt(0);
        }
        return count;
    }

    private static BigDecimal sumSellerTotals(JsonNode payload) {
        BigDecimal total = BigDecimal.ZERO;
        for (JsonNode sellerTotal : payload.path("sellerTotals")) {
            JsonNode amount = sellerTotal.path("amount");
            if (!amount.isMissingNode()) {
                total = total.add(amount.decimalValue());
            }
        }
        return total;
    }

    private static String firstSellerId(JsonNode payload) {
        for (JsonNode sellerTotal : payload.path("sellerTotals")) {
            String sellerId = text(sellerTotal, "sellerId");
            if (sellerId != null && !sellerId.isBlank()) {
                return sellerId;
            }
        }
        return null;
    }

    private JsonNode readTree(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception exception) {
            throw new IllegalArgumentException("order event payload is invalid", exception);
        }
    }

    private static String text(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        return value.isMissingNode() ? null : value.asText();
    }

    private static String textOrDefault(JsonNode node, String fieldName, String defaultValue) {
        JsonNode value = node.path(fieldName);
        return value.isMissingNode() || value.asText().isBlank() ? defaultValue : value.asText();
    }

    @DltHandler
    public void handleDlt(String message) {
        LOG.error("Message sent to DLT after retries exhausted: {}", message);
    }
}
