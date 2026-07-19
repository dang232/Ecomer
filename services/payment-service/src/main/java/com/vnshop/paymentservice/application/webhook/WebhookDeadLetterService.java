package com.vnshop.paymentservice.application.webhook;

import com.vnshop.paymentservice.domain.WebhookDeadLetterRecord;
import com.vnshop.paymentservice.domain.port.out.WebhookDeadLetterPort;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Counter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Publishes failed webhooks to the dead-letter topic {@code payment.webhooks.dlt}
 * and persists them to the database for admin visibility and retry.
 *
 * <p>Also fires a {@code notification.alert} event so downstream notification
 * services (Slack, email) can alert on-call.
 *
 * <p>Micrometer counters emitted:
 * <ul>
 *   <li>{@code webhook.processed.total} (provider, event_type)</li>
 *   <li>{@code webhook.failed.total} (provider, event_type)</li>
 *   <li>{@code webhook.dlt.total} (provider)</li>
 * </ul>
 */
@Service
public class WebhookDeadLetterService {

    private static final Logger log = LoggerFactory.getLogger(WebhookDeadLetterService.class);

    static final String DLT_TOPIC = "payment.webhooks.dlt";
    static final String ALERT_TOPIC = "notification.alert";

    private final WebhookDeadLetterPort deadLetterPort;
    private final ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider;
    private final MeterRegistry meterRegistry;

    public WebhookDeadLetterService(
            WebhookDeadLetterPort deadLetterPort,
            ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider,
            MeterRegistry meterRegistry) {
        this.deadLetterPort = Objects.requireNonNull(deadLetterPort, "deadLetterPort is required");
        this.kafkaTemplateProvider = Objects.requireNonNull(kafkaTemplateProvider, "kafkaTemplateProvider is required");
        this.meterRegistry = Objects.requireNonNull(meterRegistry, "meterRegistry is required");
    }

    /**
     * Record a successfully processed webhook (increments processed counter).
     */
    public void recordProcessed(String provider, String eventType) {
        webhookCounter("webhook.processed.total", provider, eventType).increment();
    }

    /**
     * Record a transient webhook failure (increments failed counter).
     */
    public void recordFailure(String provider, String eventType) {
        webhookCounter("webhook.failed.total", provider, eventType).increment();
    }

    /**
     * Send a webhook to the dead-letter topic after exhausting all retries.
     * Persists the record, publishes to Kafka DLT, and sends a notification alert.
     */
    public void sendToDeadLetter(String webhookId, String provider, String eventType,
                                  String payload, String failureReason, int attempts) {
        Instant now = Instant.now();

        // Persist to DB for admin API visibility
        WebhookDeadLetterRecord record = new WebhookDeadLetterRecord(
                UUID.randomUUID(),
                webhookId,
                provider,
                eventType,
                payload,
                failureReason,
                attempts,
                now,
                null,
                0
        );
        deadLetterPort.save(record);

        // Increment DLT metric
        dltCounter("webhook.dlt.total", provider).increment();

        // Structured error log
        log.error("webhook-dlt webhookId={} provider={} eventType={} attempts={} reason={}",
                webhookId, provider, eventType, attempts, failureReason);

        KafkaTemplate<String, Object> kafkaTemplate = kafkaTemplateProvider.getIfAvailable();
        if (kafkaTemplate == null) {
            log.warn("webhook-dlt-kafka-unavailable: DLT and alert events not published for webhookId={}", webhookId);
            return;
        }

        WebhookDltEvent dltEvent = new WebhookDltEvent(
                webhookId, provider, eventType, payload, failureReason, attempts, now);

        kafkaTemplate.send(DLT_TOPIC, webhookId, dltEvent);
        kafkaTemplate.send(ALERT_TOPIC, webhookId, WebhookAlertEvent.fromDlt(dltEvent));
    }

    private Counter webhookCounter(String name, String provider, String eventType) {
        return Counter.builder(name)
                .tag("provider", provider)
                .tag("event_type", eventType)
                .register(meterRegistry);
    }

    private Counter dltCounter(String name, String provider) {
        return Counter.builder(name)
                .tag("provider", provider)
                .register(meterRegistry);
    }
}
