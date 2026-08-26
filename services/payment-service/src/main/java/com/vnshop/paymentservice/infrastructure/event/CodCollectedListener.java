package com.vnshop.paymentservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.application.ConfirmCodCollectionUseCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.stereotype.Service;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import com.vnshop.paymentservice.infrastructure.dlt.DurableDltService;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Consumes only the versioned, evidence-backed shipping COD collection event. */
@Service
public class CodCollectedListener {
    private static final Logger LOG = LoggerFactory.getLogger(CodCollectedListener.class);
    private static final String TOPIC = "shipping.cod.collected";

    private final ConfirmCodCollectionUseCase confirmCodCollection;
    private final ObjectMapper objectMapper;
    private final DurableDltService durableDltService;

    public CodCollectedListener(ConfirmCodCollectionUseCase confirmCodCollection, ObjectMapper objectMapper,
                                DurableDltService durableDltService) {
        this.confirmCodCollection = Objects.requireNonNull(confirmCodCollection, "confirmCodCollection is required");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is required");
        this.durableDltService = Objects.requireNonNull(durableDltService, "durableDltService is required");
    }


    @RetryableTopic(attempts = "3", dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = ".dlt", retryTopicSuffix = ".retry")
    @KafkaListener(topics = TOPIC, groupId = "payment-service-cod-collection", concurrency = "3")
    public void onCodCollected(String eventJson) {
        JsonNode envelope;
        try {
            envelope = objectMapper.readTree(eventJson);
        } catch (Exception exception) {
            LOG.warn("cod-collected event is not valid JSON; ignoring for retry/DLT handling", exception);
            return;
        }
        if (!"SHIPPING_COD_COLLECTED".equals(text(envelope, "eventType"))
                || envelope.path("schemaVersion").asInt(-1) != 1
                || !"shipping-service".equals(text(envelope, "producer"))) {
            LOG.warn("cod-collected event has unsupported envelope; no payment mutation performed");
            return;
        }

        JsonNode payload = envelope.path("payload");
        try {
            confirmCodCollection.confirm(new ConfirmCodCollectionUseCase.Command(
                    UUID.fromString(required(payload, "collectionId")),
                    UUID.fromString(required(payload, "shipmentId")),
                    UUID.fromString(required(payload, "orderId")).toString(),
                    required(payload, "carrier"),
                    new BigDecimal(required(payload, "amount")),
                    required(payload, "currency"),
                    Instant.parse(required(payload, "collectedAt"))));
        } catch (IllegalArgumentException exception) {
            LOG.warn("cod-collected event failed evidence validation; no payment mutation performed: {}",
                    exception.getMessage());
        }
    }

    @DltHandler
    public void handleDlt(ConsumerRecord<String, String> record) {
        durableDltService.store(record, "cod-collected-listener DLT payload received", 3);
        LOG.error("shipping.cod.collected event sent to DLT: {}", record.value());
    }

    private static String required(JsonNode node, String field) {
        String value = text(node, field);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("missing " + field);
        }
        return value;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }
}
