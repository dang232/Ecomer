package com.vnshop.sellerfinanceservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.sellerfinanceservice.domain.port.out.SettlementReleaseCandidateRepositoryPort;
import java.util.UUID;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies return, dispute, and fraud hold changes to pending settlements. */
@Service
public class SettlementHoldListener {
    private final ObjectMapper objectMapper;
    private final SettlementReleaseCandidateRepositoryPort candidateRepository;

    public SettlementHoldListener(ObjectMapper objectMapper,
                                  SettlementReleaseCandidateRepositoryPort candidateRepository) {
        this.objectMapper = objectMapper;
        this.candidateRepository = candidateRepository;
    }

    @RetryableTopic(attempts = "3", dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = ".DLT", retryTopicSuffix = ".retry")
    @KafkaListener(topics = "settlement.hold", groupId = "seller-finance-settlement-hold", concurrency = "3")
    @Transactional
    public void onSettlementHold(String eventJson) {
        JsonNode envelope = readTree(eventJson);
        JsonNode payload = envelope.path("payload").isTextual()
                ? readTree(envelope.path("payload").asText()) : envelope.path("payload");
        UUID orderId = UUID.fromString(requiredText(payload, "orderId"));
        Long subOrderId = payload.path("subOrderId").isNull() || payload.path("subOrderId").isMissingNode()
                ? null : payload.path("subOrderId").asLong();
        String holdType = requiredText(payload, "holdType");
        candidateRepository.updateHold(orderId, subOrderId, holdType, payload.path("open").asBoolean());
    }

    @DltHandler
    public void handleDlt(String message) {
        // Hold changes remain observable in Kafka tooling for replay.
    }

    private JsonNode readTree(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception exception) {
            throw new IllegalArgumentException("settlement.hold payload is not valid JSON", exception);
        }
    }

    private static String requiredText(JsonNode node, String fieldName) {
        String value = node.path(fieldName).asText();
        if (value.isBlank()) throw new IllegalArgumentException(fieldName + " is required");
        return value;
    }
}
