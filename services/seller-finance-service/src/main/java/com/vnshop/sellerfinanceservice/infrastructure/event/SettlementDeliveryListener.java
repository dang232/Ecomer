package com.vnshop.sellerfinanceservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.sellerfinanceservice.domain.port.out.SettlementReleaseCandidateRepositoryPort;
import java.time.Instant;
import java.util.UUID;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Records verified delivery timestamps used by the seven-day release gate. */
@Service
public class SettlementDeliveryListener {
    private final ObjectMapper objectMapper;
    private final SettlementReleaseCandidateRepositoryPort candidateRepository;

    public SettlementDeliveryListener(ObjectMapper objectMapper,
                                      SettlementReleaseCandidateRepositoryPort candidateRepository) {
        this.objectMapper = objectMapper;
        this.candidateRepository = candidateRepository;
    }

    @RetryableTopic(attempts = "3", dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = ".DLT", retryTopicSuffix = ".retry")
    @KafkaListener(topics = "order.delivered", groupId = "seller-finance-settlement-delivery", concurrency = "3")
    @Transactional
    public void onOrderDelivered(String eventJson) {
        JsonNode envelope = readTree(eventJson);
        JsonNode payload = envelope.path("payload").isTextual()
                ? readTree(envelope.path("payload").asText()) : envelope.path("payload");
        UUID orderId = UUID.fromString(requiredText(payload, "orderId"));
        Instant deliveredAt = Instant.parse(payload.path("deliveredAt").asText(Instant.now().toString()));
        for (JsonNode sellerTotal : payload.path("sellerTotals")) {
            JsonNode rawSubOrderId = sellerTotal.get("subOrderId");
            if (rawSubOrderId != null && rawSubOrderId.canConvertToLong()) {
                candidateRepository.markDelivered(orderId, rawSubOrderId.asLong(), deliveredAt);
            }
        }
    }

    @DltHandler
    public void handleDlt(String message) {
        // Delivery facts remain observable in Kafka tooling for replay.
    }

    private JsonNode readTree(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception exception) {
            throw new IllegalArgumentException("order.delivered payload is not valid JSON", exception);
        }
    }

    private static String requiredText(JsonNode node, String fieldName) {
        String value = node.path(fieldName).asText();
        if (value.isBlank()) throw new IllegalArgumentException(fieldName + " is required");
        return value;
    }
}
