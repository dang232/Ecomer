package com.vnshop.paymentservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.FxRatePort;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalGateway;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.BackOff;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import com.vnshop.paymentservice.infrastructure.dlt.DurableDltService;

/**
 * Closes the saga compensation loop for PayPal-backed orders. Order-service
 * emits {@code payment.refund_requested} from its outbox once a Return is
 * completed; this listener resolves the underlying payment, verifies it was
 * paid via PayPal, calls {@link PayPalGateway#refund} with the buyer-side VND
 * amount converted to USD, and publishes {@code payment.refunded} so the
 * order ledger and seller-wallet reversal can complete.
 *
 * <p>Idempotency is handled by PayPal: every refund call passes the returnId
 * as {@code PayPal-Request-Id}, so a Kafka redelivery (consumer-group
 * rebalance, transient network blip) hits PayPal's own dedup and returns the
 * existing refund record without issuing money twice. We don't need a local
 * dedup row — Kafka at-least-once + PayPal idempotency = exactly-once at the
 * money layer.
 *
 * <p>Non-PayPal payments are skipped silently. Each provider owns its own
 * refund mechanics; this listener is the PayPal-shaped half of the pipeline.
 *
 * <p>Bean is gated on {@code payment.paypal.enabled=true} — same gate as the
 * gateway itself, so a disabled deployment doesn't even subscribe.
 */
@Service
@ConditionalOnProperty(name = "payment.paypal.enabled", havingValue = "true")
public class PayPalRefundListener {
    private static final Logger LOGGER = LoggerFactory.getLogger(PayPalRefundListener.class);
    static final String REFUND_REQUESTED_TOPIC = "payment.refund.requested";
    static final String REFUNDED_TOPIC = "payment.refunded";

    private final PaymentRepositoryPort paymentRepository;
    private final PayPalGateway gateway;
    private final FxRatePort fxRatePort;
    private final ObjectMapper objectMapper;
    private final ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider;
    private final DurableDltService durableDltService;

    public PayPalRefundListener(
            PaymentRepositoryPort paymentRepository,
            PayPalGateway gateway,
            FxRatePort fxRatePort,
            ObjectMapper objectMapper,
            ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider,
            DurableDltService durableDltService) {
        this.paymentRepository = paymentRepository;
        this.gateway = gateway;
        this.fxRatePort = fxRatePort;
        this.objectMapper = objectMapper;
        this.kafkaTemplateProvider = kafkaTemplateProvider;
        this.durableDltService = durableDltService;
    }

    @RetryableTopic(
            attempts = "3",
            backOff = @BackOff(delay = 1000, multiplier = 2.0, maxDelay = 10000),
            dltStrategy = DltStrategy.FAIL_ON_ERROR,
             dltTopicSuffix = ".dlt",
            retryTopicSuffix = ".retry"
    )
    @KafkaListener(topics = REFUND_REQUESTED_TOPIC, groupId = "payment-service-paypal-refund", concurrency = "6")
    public void onRefundRequested(String eventJson) {
        JsonNode envelope = readTree(eventJson);
        // Order-service writes the event through its outbox — the wire shape is
        // {"eventType":"...","payload":"<inner json string>"}. Older or direct
        // publishes pass the inner payload flat; handle both.
        JsonNode payload = envelope.hasNonNull("payload")
                ? readTree(envelope.get("payload").asText())
                : envelope;

        String returnId = text(payload, "returnId");
        String orderId = text(payload, "orderId");
        String sellerId = text(payload, "sellerId");
        String amountRaw = text(payload, "amount");
        String currency = text(payload, "currency");
        String commissionTier = text(payload, "commissionTier");
        String sagaId = text(payload, "sagaId");
        if (orderId == null || orderId.isBlank() || returnId == null || returnId.isBlank() || amountRaw == null) {
            LOGGER.warn("paypal-refund skipping malformed event returnId={} orderId={} amount={}",
                    returnId, orderId, amountRaw);
            return;
        }

        Optional<Payment> maybePayment = paymentRepository.findByOrderId(orderId);
        if (maybePayment.isEmpty()) {
            LOGGER.warn("paypal-refund payment not found for orderId={} returnId={} — skipping", orderId, returnId);
            return;
        }
        Payment payment = maybePayment.get();
        if (payment.method() != PaymentMethod.PAYPAL) {
            LOGGER.debug("paypal-refund skipping non-PayPal payment orderId={} method={}", orderId, payment.method());
            return;
        }
        if (payment.status() != PaymentStatus.COMPLETED) {
            LOGGER.warn("paypal-refund payment for orderId={} is not COMPLETED (status={}) — refund cannot proceed",
                    orderId, payment.status());
            return;
        }
        String captureId = payment.transactionRef();
        if (captureId == null || captureId.isBlank()) {
            LOGGER.warn("paypal-refund payment for orderId={} has no captureId stored — cannot refund", orderId);
            return;
        }

        BigDecimal vndAmount = new BigDecimal(amountRaw);
        BigDecimal rate = fxRatePort.rate("VND", "USD");
        BigDecimal usdAmount = vndAmount.multiply(rate).setScale(2, RoundingMode.HALF_UP);

        PayPalGateway.PayPalRefund refund = gateway.refund(captureId, usdAmount, returnId);
        LOGGER.info("paypal-refund-issued orderId={} returnId={} captureId={} refundId={} status={}",
                orderId, returnId, captureId, refund.refundId(), refund.status());

        publishRefunded(payment, returnId, sellerId, commissionTier, refund, vndAmount, currency, sagaId);
    }

    private void publishRefunded(Payment payment, String returnId, String sellerId, String commissionTier,
                                  PayPalGateway.PayPalRefund refund, BigDecimal vndAmount, String currency,
                                  String sagaId) {
        KafkaTemplate<String, Object> kafkaTemplate = kafkaTemplateProvider.getIfAvailable();
        if (kafkaTemplate == null) {
            LOGGER.warn("paypal-refund cannot publish payment.refunded — KafkaTemplate not available. orderId={} returnId={}",
                    payment.orderId(), returnId);
            return;
        }
        PaymentRefundedEvent event = new PaymentRefundedEvent(
                "PAYPAL",
                payment.paymentId(),
                payment.orderId(),
                returnId,
                sellerId,
                refund.refundId(),
                refund.captureId(),
                refund.status(),
                vndAmount,
                currency != null ? currency : "VND",
                commissionTier != null ? commissionTier : "STANDARD",
                sagaId);
        kafkaTemplate.send(REFUNDED_TOPIC, payment.orderId(), event);
    }

    private JsonNode readTree(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            throw new IllegalArgumentException("payment.refund_requested payload is not valid JSON", ex);
        }
    }

    private static String text(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    @DltHandler
    public void handleDlt(ConsumerRecord<String, String> record) {
        durableDltService.store(record, "paypal-refund-listener DLT payload received", 3);
        LOGGER.error("Message sent to DLT after retries exhausted: {}", record.value());
    }
}
