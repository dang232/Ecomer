package com.vnshop.paymentservice.infrastructure.event;

import com.vnshop.paymentservice.domain.PaymentCallbackOutboxRecord;
import com.vnshop.paymentservice.domain.port.out.PaymentCallbackOutbox;
import jakarta.annotation.PostConstruct;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Polls {@code payment_svc.payment_callback_outbox} for unpublished rows and
 * fans them out to Kafka topic {@code payment.completed}, regardless of
 * provider. Mirrors the order-service {@code OutboxPublisher} shape: scheduled
 * batch poll, send-then-mark, fail-quietly so a Kafka outage just means the
 * row stays {@code published_at IS NULL} and the next tick retries.
 *
 * <p>Every promoted payment (VNPay, MoMo, Stripe, PayPal — every adapter that
 * goes through {@code PaymentPromotionService}) writes an outbox row inside the
 * promote transaction. Without this relay those rows accumulate forever and
 * order-service never learns the payment completed.
 *
 * <p>Failed deliveries are retried with exponential backoff (2^n seconds, capped
 * at 300 s). After {@value #MAX_ATTEMPTS} attempts the row is marked dead and
 * a DEAD-letter log is emitted for investigation.
 */
@Service
public class PaymentCallbackOutboxRelay {
    private static final Logger LOGGER = LoggerFactory.getLogger(PaymentCallbackOutboxRelay.class);
    static final String TOPIC = "payment.completed";
    private static final int MAX_ATTEMPTS = 8;

    private final PaymentCallbackOutbox outbox;
    private final ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider;
    private final int batchSize;
    private final long sendTimeoutMs;

    public PaymentCallbackOutboxRelay(
            PaymentCallbackOutbox outbox,
            ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider,
            @Value("${payment.outbox.batch-size:50}") int batchSize,
            @Value("${payment.outbox.send-timeout-ms:5000}") long sendTimeoutMs) {
        this.outbox = outbox;
        this.kafkaTemplateProvider = kafkaTemplateProvider;
        this.batchSize = batchSize;
        this.sendTimeoutMs = sendTimeoutMs;
    }

    @PostConstruct
    void warnIfKafkaTemplateMissing() {
        if (kafkaTemplateProvider.getIfAvailable() == null) {
            LOGGER.warn("PaymentCallbackOutboxRelay started without a KafkaTemplate bean — payment.completed events will accumulate as unpublished until Kafka is configured.");
        }
    }

    @Scheduled(fixedDelayString = "${payment.outbox.poll-interval-ms:1000}")
    public void publishPending() {
        KafkaTemplate<String, Object> kafkaTemplate = kafkaTemplateProvider.getIfAvailable();
        if (kafkaTemplate == null) {
            return;
        }
        List<PaymentCallbackOutboxRecord> pending = outbox.findRetryable(batchSize);
        for (PaymentCallbackOutboxRecord record : pending) {
            publish(kafkaTemplate, record);
        }
    }

    private void publish(KafkaTemplate<String, Object> kafkaTemplate, PaymentCallbackOutboxRecord record) {
        try {
            PaymentCompletedEvent event = new PaymentCompletedEvent(
                    record.provider(),
                    record.paymentId(),
                    record.orderId(),
                    record.transactionRef(),
                    record.status(),
                    record.amount(),
                    record.currency(),
                    record.callbackId(),
                    record.callbackEventId(),
                    record.externalAmount(),
                    record.externalCurrency(),
                    record.fxRate(),
                    record.fxRateAt());
            kafkaTemplate.send(TOPIC, record.orderId(), event).get(sendTimeoutMs, TimeUnit.MILLISECONDS);
            outbox.markPublished(record.id());
            LOGGER.debug("payment-callback-outbox published id={} provider={} orderId={}",
                    record.id(), record.provider(), record.orderId());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            recordFailure(record, e);
        } catch (ExecutionException | TimeoutException | RuntimeException e) {
            recordFailure(record, e);
        }
    }

    private void recordFailure(PaymentCallbackOutboxRecord record, Exception e) {
            int attempts = record.attemptCount() + 1;
            boolean isDead = attempts >= MAX_ATTEMPTS;
            long backoffSeconds = Math.min((long) Math.pow(2, attempts), 300);
            Instant nextAttempt = isDead ? null : Instant.now().plusSeconds(backoffSeconds);

            outbox.recordFailure(record.id(), attempts, e.getMessage(), nextAttempt, isDead);

            if (isDead) {
                LOGGER.error("payment-callback-outbox DEAD after {} attempts: id={} orderId={} error={}",
                        attempts, record.id(), record.orderId(), e.getMessage());
            } else {
                LOGGER.warn("payment-callback-outbox retry scheduled: id={} attempt={} nextIn={}s",
                        record.id(), attempts, backoffSeconds);
            }
    }
}
