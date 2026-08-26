package com.vnshop.orderservice.infrastructure.event.saga;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.vnshop.orderservice.domain.port.out.SagaCompensationPublisherPort;
import com.vnshop.orderservice.infrastructure.outbox.CompensationOutboxEventJpaEntity;
import com.vnshop.orderservice.infrastructure.outbox.CompensationOutboxRepository;
import java.util.HashMap;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Stages saga compensation requests in a dedicated transactional outbox.
 */
@Component
public class KafkaSagaCompensationPublisher implements SagaCompensationPublisherPort {

    private static final Logger LOG = LoggerFactory.getLogger(KafkaSagaCompensationPublisher.class);

    private static final String TOPIC_INVENTORY_RELEASE_REQUESTED = "inventory.release-requested";
    private static final String TOPIC_PAYMENT_REFUND_REQUESTED = "payment.refund.requested";
    private static final String TOPIC_SHIPPING_CANCEL_REQUESTED = "shipping.cancel-requested";

    private final CompensationOutboxRepository repository;
    private final ObjectMapper objectMapper;

    public KafkaSagaCompensationPublisher(
            CompensationOutboxRepository repository,
            ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void publishInventoryReleaseRequested(String orderId, String sagaId) {
        stage(orderId, sagaId, "INVENTORY_RELEASE", TOPIC_INVENTORY_RELEASE_REQUESTED, Map.of());
    }

    @Override
    public void publishPaymentRefundRequested(String orderId, String sagaId) {
        stage(orderId, sagaId, "PAYMENT_REFUND", TOPIC_PAYMENT_REFUND_REQUESTED, Map.of());
    }

    @Override
    public void publishShippingCancellationRequested(String orderId, String sagaId, String reason) {
        stage(orderId, sagaId, "SHIPPING_CANCEL", TOPIC_SHIPPING_CANCEL_REQUESTED,
                Map.of("reason", reason == null ? "order-compensation" : reason));
    }

    private void stage(String orderId, String sagaId, String step, String topic, Map<String, String> extra) {
        String operationId = sagaId + ":" + step;
        Map<String, String> data = new HashMap<>(extra);
        data.put("orderId", orderId);
        data.put("sagaId", sagaId);
        data.put("step", step);
        data.put("operationId", operationId);
        data.put("attempt", "0");
        if ("PAYMENT_REFUND".equals(step)) {
            data.put("reversalId", UUID.nameUUIDFromBytes(
                    ("refund:" + sagaId).getBytes(StandardCharsets.UTF_8)).toString());
        }
        int inserted = repository.insertIfAbsent(CompensationOutboxEventJpaEntity.pending(
                orderId, sagaId, step, operationId, topic, toJson(data)));
        LOG.debug("Staged compensation operationId={} inserted={} duplicate={}",
                operationId, inserted, inserted == 0);
    }

    private String toJson(Map<String, String> data) {
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize saga compensation event", e);
        }
    }
}
