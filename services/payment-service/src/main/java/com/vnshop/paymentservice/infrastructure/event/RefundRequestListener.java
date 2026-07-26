package com.vnshop.paymentservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.application.OrderNotFoundException;
import com.vnshop.paymentservice.application.PaymentNotRefundableException;
import com.vnshop.paymentservice.application.RefundPaymentCommand;
import com.vnshop.paymentservice.application.RefundPaymentUseCase;
import com.vnshop.paymentservice.domain.PaymentMethod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.BackOff;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Generic refund listener: handles all non-PayPal payment methods by routing
 * through {@link RefundPaymentUseCase}. PayPal refunds are handled by the
 * dedicated {@link PayPalRefundListener} (separate consumer group) which
 * performs its own FX conversion and idempotency via PayPal's native
 * {@code PayPal-Request-Id} header.
 *
 * <p>Consumer group {@code payment-service-refund} is distinct from
 * {@code payment-service-paypal-refund} — both groups consume the same
 * {@code payment.refund.requested} topic independently. PayPal messages are
 * identified by the payment's stored method and skipped here to prevent
 * double-refunding.
 *
 * <p>On success this listener publishes {@code payment.refunded} with the
 * {@code sagaId} intact so the order-service
 * {@code SagaCompensationListener} can close the compensation step.
 */
@Service
@ConditionalOnProperty(name = "payment.kafka.listeners.enabled", havingValue = "true", matchIfMissing = true)
public class RefundRequestListener {

    private static final Logger log = LoggerFactory.getLogger(RefundRequestListener.class);
    static final String REFUND_REQUESTED_TOPIC = "payment.refund.requested";
    static final String REFUNDED_TOPIC = "payment.refunded";

    private final RefundPaymentUseCase refundPaymentUseCase;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public RefundRequestListener(
            RefundPaymentUseCase refundPaymentUseCase,
            KafkaTemplate<String, Object> kafkaTemplate,
            ObjectMapper objectMapper) {
        this.refundPaymentUseCase = Objects.requireNonNull(refundPaymentUseCase, "refundPaymentUseCase is required");
        this.kafkaTemplate = Objects.requireNonNull(kafkaTemplate, "kafkaTemplate is required");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is required");
    }

    @RetryableTopic(
            attempts = "3",
            backOff = @BackOff(delay = 1000, multiplier = 2.0, maxDelay = 10000),
            dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = ".DLT",
            retryTopicSuffix = ".retry"
    )
    @KafkaListener(
            topics = REFUND_REQUESTED_TOPIC,
            groupId = "payment-service-refund",
            concurrency = "6"
    )
    public void onRefundRequested(String eventJson) {
        JsonNode envelope = readTree(eventJson);
        JsonNode payload = envelope.hasNonNull("payload")
                ? readTree(envelope.get("payload").asText())
                : envelope;

        String orderId = text(payload, "orderId");
        String sagaId = text(payload, "sagaId");
        String reason = text(payload, "reason");
        String methodHint = text(payload, "paymentMethod");
        String returnId = text(payload, "returnId");

        if (orderId == null || orderId.isBlank()) {
            log.warn("refund-listener skipping malformed event — missing orderId sagaId={}", sagaId);
            return;
        }

        // Skip PayPal — PayPalRefundListener owns that path and handles FX conversion
        // and idempotency natively. Handling it here too would double-refund.
        if (PaymentMethod.PAYPAL.name().equalsIgnoreCase(methodHint)) {
            log.debug("refund-listener skipping PAYPAL orderId={} — handled by PayPalRefundListener", orderId);
            return;
        }

        UUID reversalId = parseUuid(text(payload, "reversalId"));
        if (reversalId == null) reversalId = parseUuid(returnId);
        if (reversalId == null) {
            log.warn("refund-listener skipping malformed event: missing valid reversalId orderId={}", orderId);
            return;
        }
        RefundPaymentCommand command = new RefundPaymentCommand(
                orderId, sagaId, reason, reversalId, decimal(payload, "amount"));

        try {
            RefundPaymentUseCase.RefundResult result = refundPaymentUseCase.refund(command);
            publishRefunded(result, sagaId, returnId);
        } catch (OrderNotFoundException ex) {
            log.warn("refund-listener payment not found orderId={} sagaId={} — skipping", orderId, sagaId);
        } catch (PaymentNotRefundableException ex) {
            log.warn("refund-listener payment not refundable orderId={} sagaId={} reason={}",
                    orderId, sagaId, ex.getMessage());
        }
    }

    private void publishRefunded(RefundPaymentUseCase.RefundResult result, String sagaId, String returnId) {
        PaymentRefundedEvent event = new PaymentRefundedEvent(
                result.payment().method().name(),
                result.payment().paymentId(),
                result.payment().orderId(),
                returnId,
                null,       // sellerId — not available at this layer
                result.refundId(),
                result.payment().transactionRef(),
                result.payment().status().name(),
                result.amount(),
                "VND",
                null,       // commissionTier — not available at this layer
                sagaId,
                result.reversalId().toString());
        kafkaTemplate.send(REFUNDED_TOPIC, result.payment().orderId(), event);
        log.info("refund-listener published payment.refunded orderId={} refundId={} sagaId={}",
                result.payment().orderId(), result.refundId(), sagaId);
    }

    private JsonNode readTree(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            throw new IllegalArgumentException("payment.refund.requested payload is not valid JSON", ex);
        }
    }

    private static String text(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private static UUID parseUuid(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try { return UUID.fromString(raw); } catch (IllegalArgumentException ignored) { return null; }
    }

    private static BigDecimal decimal(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        if (value == null || value.isNull() || value.asText().isBlank()) return null;
        try { return new BigDecimal(value.asText()); } catch (NumberFormatException ignored) { return null; }
    }

    @DltHandler
    public void handleDlt(String message) {
        log.error("refund-listener message sent to DLT after retries exhausted: {}", message);
    }
}
