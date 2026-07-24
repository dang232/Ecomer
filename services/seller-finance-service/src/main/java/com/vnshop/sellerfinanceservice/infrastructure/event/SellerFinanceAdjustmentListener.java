package com.vnshop.sellerfinanceservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.stereotype.Service;

/**
 * Validates immutable seller-finance adjustment snapshots published by order-service.
 * Ledger application intentionally starts in Task 6; invalid messages are retried and
 * eventually routed to the DLT rather than being silently discarded.
 */
@Service
@ConditionalOnProperty(prefix = "seller-finance.adjustment-consumer", name = "enabled", havingValue = "true")
public class SellerFinanceAdjustmentListener {
    private static final Logger LOGGER = LoggerFactory.getLogger(SellerFinanceAdjustmentListener.class);
    private static final int SUPPORTED_SCHEMA_VERSION = 1;
    private static final Set<String> ENVELOPE_FIELDS = Set.of(
            "eventId", "eventType", "schemaVersion", "occurredAt", "producer", "aggregateId",
            "correlationId", "causationId", "payload");
    private static final Set<String> PAYLOAD_FIELDS = Set.of(
            "adjustmentId", "adjustmentType", "allocationId", "allocationVersion", "orderId", "subOrderId",
            "sellerId", "commissionTier", "frozenCommissionRate", "reversalId", "currency", "components",
            "releaseMetadata");
    private static final Set<String> COMPONENT_NAMES = Set.of(
            "itemGmvAmount",
            "sellerFundedDiscountAmount",
            "platformFundedDiscountAmount",
            "buyerShippingChargeAmount",
            "sellerShippingPayableAmount",
            "taxChargedAmount",
            "sellerTaxPayableAmount",
            "commissionBaseAmount",
            "platformCommissionAmount",
            "sellerPayableAmount",
            "buyerPaidAmount",
            "currency");

    private final ObjectMapper objectMapper;

    public SellerFinanceAdjustmentListener(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @RetryableTopic(
            attempts = "3",
            dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = ".DLT",
            retryTopicSuffix = ".retry")
    @KafkaListener(topics = "seller.finance.adjustment", groupId = "seller-finance-service-adjustment", concurrency = "6")
    public void onSellerFinanceAdjustment(String eventJson) {
        JsonNode outboxEnvelope = readTree(eventJson, "outbox envelope");
        JsonNode adjustmentEnvelope = unwrapPayload(outboxEnvelope);
        validateEnvelope(adjustmentEnvelope);

        JsonNode payload = adjustmentEnvelope.path("payload");
        validatePayload(payload);
        LOGGER.info("seller-finance-adjustment-validated eventId={} adjustmentId={} allocationId={} orderId={} subOrderId={} sellerId={} components={}",
                requiredText(adjustmentEnvelope, "eventId"),
                requiredText(payload, "adjustmentId"),
                requiredText(payload, "allocationId"),
                requiredText(payload, "orderId"),
                payload.path("subOrderId").asLong(),
                requiredText(payload, "sellerId"),
                payload.path("components"));
    }

    @DltHandler
    public void handleDlt(String message) {
        LOGGER.error("seller.finance.adjustment sent to DLT after retries exhausted: {}", message);
    }

    private JsonNode unwrapPayload(JsonNode outboxEnvelope) {
        JsonNode payload = outboxEnvelope.path("payload");
        if (payload.isTextual()) {
            return readTree(payload.asText(), "seller finance adjustment envelope");
        }
        if (payload.isObject()) {
            return payload;
        }
        throw invalid("outbox envelope payload is required");
    }

    private void validateEnvelope(JsonNode envelope) {
        requireExactFields(envelope, ENVELOPE_FIELDS, "envelope");
        requiredUuid(envelope, "eventId");
        if (!"SELLER_FINANCE_ADJUSTMENT".equals(requiredText(envelope, "eventType"))) {
            throw invalid("eventType must be SELLER_FINANCE_ADJUSTMENT");
        }
        if (envelope.path("schemaVersion").asInt(-1) != SUPPORTED_SCHEMA_VERSION) {
            throw invalid("unsupported schemaVersion");
        }
        requiredTimestamp(envelope, "occurredAt");
        if (!"order-service".equals(requiredText(envelope, "producer"))) {
            throw invalid("producer must be order-service");
        }
        String aggregateId = requiredText(envelope, "aggregateId");
        String correlationId = requiredText(envelope, "correlationId");
        requiredText(envelope, "causationId");
        if (!envelope.path("payload").isObject()) {
            throw invalid("payload must be an object");
        }
        String sellerId = requiredText(envelope.path("payload"), "sellerId");
        String orderId = requiredText(envelope.path("payload"), "orderId");
        if (!aggregateId.equals(sellerId)) {
            throw invalid("aggregateId must match payload.sellerId");
        }
        if (!correlationId.equals(orderId)) {
            throw invalid("correlationId must match payload.orderId");
        }
    }

    private void validatePayload(JsonNode payload) {
        requireExactFields(payload, PAYLOAD_FIELDS, "payload");
        requiredUuid(payload, "adjustmentId");
        String adjustmentType = requiredText(payload, "adjustmentType");
        if (!Set.of("CREDIT", "RELEASE").contains(adjustmentType)) {
            throw invalid("adjustmentType is unsupported");
        }
        requiredUuid(payload, "allocationId");
        if (!payload.path("allocationVersion").canConvertToInt() || payload.path("allocationVersion").asInt() < 1) {
            throw invalid("allocationVersion must be a positive integer");
        }
        requiredUuid(payload, "orderId");
        requiredPositiveLong(payload, "subOrderId");
        requiredText(payload, "sellerId");
        if (!Set.of("STANDARD", "VERIFIED", "PREFERRED", "MALL").contains(requiredText(payload, "commissionTier"))) {
            throw invalid("commissionTier is unsupported");
        }
        JsonNode rate = payload.path("frozenCommissionRate");
        if (!rate.isNumber() || rate.decimalValue().compareTo(BigDecimal.ZERO) < 0
                || rate.decimalValue().compareTo(BigDecimal.ONE) > 0) {
            throw invalid("frozenCommissionRate must be between 0 and 1");
        }
        requiredNullableUuid(payload, "reversalId");
        if (!"VND".equals(requiredText(payload, "currency"))) {
            throw invalid("currency must be VND");
        }
        validateComponents(payload.path("components"));
        if (!"VND".equals(payload.path("components").path("currency").asText())) {
            throw invalid("components.currency must be VND");
        }
        validateReleaseMetadata(payload, adjustmentType);
    }

    private void validateComponents(JsonNode components) {
        if (!components.isObject() || components.size() != COMPONENT_NAMES.size()) {
            throw invalid("components must contain the exact v1 component snapshot");
        }
        Iterator<String> names = components.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            if (!COMPONENT_NAMES.contains(name)) {
                throw invalid("components contains unsupported field " + name);
            }
            JsonNode value = components.path(name);
            if ("currency".equals(name)) {
                if (!value.isTextual() || !"VND".equals(value.asText())) {
                    throw invalid("component currency must be VND");
                }
            } else if (!value.isIntegralNumber() || value.asLong() < 0) {
                throw invalid("component " + name + " must be a non-negative integer");
            }
        }
        if (components.path("itemGmvAmount").asLong() < 1) {
            throw invalid("component itemGmvAmount must be positive");
        }
    }

    private void validateReleaseMetadata(JsonNode payload, String adjustmentType) {
        JsonNode metadata = payload.get("releaseMetadata");
        if ("RELEASE".equals(adjustmentType)) {
            if (metadata == null || !metadata.isObject()) {
                throw invalid("releaseMetadata is required for RELEASE");
            }
            requireExactFields(metadata, Set.of("reason", "confirmedBy", "confirmedAt"), "releaseMetadata");
            if (!"BUYER_CONFIRMED".equals(requiredText(metadata, "reason"))) {
                throw invalid("releaseMetadata.reason is unsupported");
            }
            requiredText(metadata, "confirmedBy");
            requiredTimestamp(metadata, "confirmedAt");
        } else if (metadata == null || !metadata.isNull()) {
            throw invalid("releaseMetadata must be null for CREDIT");
        }
    }

    private static void requireExactFields(JsonNode node, Set<String> expected, String objectName) {
        if (!node.isObject()) {
            throw invalid(objectName + " must be an object");
        }
        Set<String> actual = new HashSet<>();
        node.fieldNames().forEachRemaining(actual::add);
        if (!expected.equals(actual)) {
            throw invalid(objectName + " contains unexpected or missing fields");
        }
    }

    private JsonNode readTree(String json, String description) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception exception) {
            throw invalid(description + " is not valid JSON", exception);
        }
    }

    private static String requiredText(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        if (!value.isTextual() || value.asText().isBlank()) {
            throw invalid(fieldName + " is required");
        }
        return value.asText();
    }

    private static void requiredUuid(JsonNode node, String fieldName) {
        try {
            UUID.fromString(requiredText(node, fieldName));
        } catch (IllegalArgumentException exception) {
            throw invalid(fieldName + " must be a UUID", exception);
        }
    }

    private static void requiredNullableUuid(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        if (value == null) {
            throw invalid(fieldName + " is required");
        }
        if (!value.isNull()) {
            try {
                UUID.fromString(value.asText());
            } catch (IllegalArgumentException exception) {
                throw invalid(fieldName + " must be a UUID", exception);
            }
        }
    }

    private static void requiredPositiveLong(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        if (!value.isIntegralNumber() || value.asLong() < 1) {
            throw invalid(fieldName + " must be a positive numeric Long");
        }
    }

    private static void requiredTimestamp(JsonNode node, String fieldName) {
        try {
            Instant.parse(requiredText(node, fieldName));
        } catch (DateTimeParseException exception) {
            throw invalid(fieldName + " must be an ISO-8601 timestamp", exception);
        }
    }

    private static IllegalArgumentException invalid(String message) {
        return new IllegalArgumentException("seller finance adjustment " + message);
    }

    private static IllegalArgumentException invalid(String message, Exception cause) {
        return new IllegalArgumentException("seller finance adjustment " + message, cause);
    }
}
