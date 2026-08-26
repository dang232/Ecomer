package com.vnshop.inventoryservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.inventoryservice.application.ReleaseStockUseCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.BackOff;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.stereotype.Component;

/**
 * Consumes {@code inventory.release-requested} events published by the order-service
 * when the inventory gRPC circuit breaker is open. Delegates to
 * {@link ReleaseStockUseCase} so compensation is guaranteed even when the
 * synchronous gRPC path is unavailable.
 */
@Component
public class ReleaseRequestedKafkaConsumer {

    private static final Logger log = LoggerFactory.getLogger(ReleaseRequestedKafkaConsumer.class);

    private final ReleaseStockUseCase releaseStockUseCase;
    private final ObjectMapper objectMapper;

    public ReleaseRequestedKafkaConsumer(ReleaseStockUseCase releaseStockUseCase, ObjectMapper objectMapper) {
        this.releaseStockUseCase = releaseStockUseCase;
        this.objectMapper = objectMapper;
    }

    @RetryableTopic(
            attempts = "4",
            backOff = @BackOff(delay = 1000, multiplier = 2.0, maxDelay = 10000),
            dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = ".DLT",
            retryTopicSuffix = ".retry")
    @KafkaListener(topics = "inventory.release-requested", groupId = "inventory-svc-release")
    public void onReleaseRequested(String message) {
        try {
            JsonNode node = objectMapper.readTree(message);
            String orderId = node.get("orderId").asText();
            String sagaId = node.path("sagaId").asText(null);
            log.info("Received inventory.release-requested for orderId={}", orderId);
            releaseStockUseCase.release(orderId, sagaId);
        } catch (Exception e) {
            log.error("Failed to process inventory.release-requested message: {}", message, e);
            throw new RuntimeException("inventory.release-requested processing failed", e);
        }
    }

    @org.springframework.kafka.annotation.DltHandler
    public void handleDlt(String message) {
        log.error("inventory release request exhausted retries; manual replay required: {}", message);
    }
}
