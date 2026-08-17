package com.vnshop.orderservice.infrastructure.event.saga;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.port.out.SagaCompensationPublisherPort;
import java.time.Instant;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Publishes saga compensation request events directly to Kafka, bypassing the outbox.
 *
 * <p>The outbox {@code topicFor()} helper converts underscores to dots, which would
 * produce {@code inventory.release.requested} instead of the correct
 * {@code inventory.release-requested}. Publishing directly preserves the exact topic
 * names that downstream services subscribe to.
 */
@Component
public class KafkaSagaCompensationPublisher implements SagaCompensationPublisherPort {

    private static final Logger LOG = LoggerFactory.getLogger(KafkaSagaCompensationPublisher.class);

    private static final String TOPIC_INVENTORY_RELEASE_REQUESTED = "inventory.release-requested";
    private static final String TOPIC_PAYMENT_REFUND_REQUESTED = "payment.refund.requested";
    private static final String TOPIC_SHIPPING_CANCEL_REQUESTED = "shipping.cancel-requested";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public KafkaSagaCompensationPublisher(
            KafkaTemplate<String, String> kafkaTemplate,
            ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void publishInventoryReleaseRequested(String orderId, String sagaId) {
        String payload = toJson(Map.of(
                "orderId", orderId,
                "sagaId", sagaId,
                "timestamp", Instant.now().toString()
        ));
        kafkaTemplate.send(TOPIC_INVENTORY_RELEASE_REQUESTED, orderId, payload);
        LOG.info("Published inventory.release-requested for saga {} order {}", sagaId, orderId);
    }

    @Override
    public void publishPaymentRefundRequested(String orderId, String sagaId) {
        String payload = toJson(Map.of(
                "orderId", orderId,
                "sagaId", sagaId,
                "timestamp", Instant.now().toString()
        ));
        kafkaTemplate.send(TOPIC_PAYMENT_REFUND_REQUESTED, orderId, payload);
        LOG.info("Published payment.refund.requested for saga {} order {}", sagaId, orderId);
    }

    @Override
    public void publishShippingCancellationRequested(String orderId, String sagaId, String reason) {
        String payload = toJson(Map.of(
                "orderId", orderId,
                "sagaId", sagaId,
                "reason", reason == null ? "order-compensation" : reason,
                "timestamp", Instant.now().toString()
        ));
        kafkaTemplate.send(TOPIC_SHIPPING_CANCEL_REQUESTED, orderId, payload);
        LOG.info("Published shipping.cancel-requested for saga {} order {}", sagaId, orderId);
    }

    private String toJson(Map<String, String> data) {
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize saga compensation event", e);
        }
    }
}
