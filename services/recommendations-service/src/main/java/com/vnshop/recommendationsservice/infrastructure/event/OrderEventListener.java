package com.vnshop.recommendationsservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.recommendationsservice.application.CoPurchaseAggregator;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.stereotype.Service;

/**
 * Consumes {@code order.created} events and feeds the co-purchase aggregator.
 *
 * <p>The order-service emits the same envelope shape that the projection and
 * finance listeners read: an outer object with a {@code payload} JSON string,
 * containing {@code orderId}, {@code sellerTotals}, and (added in this
 * patch) {@code items} with {@code productId} fields. We tolerate both
 * envelope-wrapped and bare payloads to match the existing pattern.
 *
 * <p>Marked {@code @ConditionalOnProperty} on a service-specific flag so
 * unit tests that don't bring up Kafka can disable the listener without
 * stripping Jackson auto-config from the context.
 */
@Service
@ConditionalOnProperty(name = "vnshop.recommendations.events.enabled", havingValue = "true", matchIfMissing = true)
public class OrderEventListener {
    private static final Logger LOGGER = LoggerFactory.getLogger(OrderEventListener.class);

    private final CoPurchaseAggregator aggregator;
    private final ObjectMapper objectMapper;

    public OrderEventListener(CoPurchaseAggregator aggregator, ObjectMapper objectMapper) {
        this.aggregator = aggregator;
        this.objectMapper = objectMapper;
    }

    @RetryableTopic(attempts = "3", dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = ".DLT", retryTopicSuffix = ".retry")
    @KafkaListener(topics = "order.created", groupId = "recommendations-service", concurrency = "6")
    public void onOrderCreated(String eventJson) {
        try {
            JsonNode envelope = objectMapper.readTree(eventJson);
            JsonNode payload = envelope.hasNonNull("payload")
                    ? objectMapper.readTree(envelope.get("payload").asText())
                    : envelope;
            String orderId = textOrNull(payload, "orderId");
            if (orderId == null) {
                LOGGER.warn("Skipping order.created event with no orderId");
                return;
            }
            List<String> productIds = new ArrayList<>();
            for (JsonNode item : payload.path("items")) {
                String productId = textOrNull(item, "productId");
                if (productId != null) {
                    productIds.add(productId);
                }
            }
            aggregator.recordOrder(orderId, productIds);
        } catch (Exception exception) {
            throw new IllegalArgumentException("order.created payload is invalid", exception);
        }
    }

    private static String textOrNull(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        String text = value.asText();
        return text == null || text.isBlank() ? null : text;
    }

}
