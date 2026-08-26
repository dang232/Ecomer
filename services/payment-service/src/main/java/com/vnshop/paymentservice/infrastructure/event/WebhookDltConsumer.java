package com.vnshop.paymentservice.infrastructure.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.application.webhook.WebhookAlertEvent;
import com.vnshop.paymentservice.application.webhook.WebhookDltEvent;
import com.vnshop.paymentservice.infrastructure.dlt.DurableDltService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * Consumes {@code payment.webhooks.dlt} and fires a {@code notification.alert}
 * event for each message. Structured ERROR log is emitted for every DLT message
 * so Grafana log-based alerts can fire on {@code webhook-dlt-received}.
 */
@Component
public class WebhookDltConsumer {

    private static final Logger log = LoggerFactory.getLogger(WebhookDltConsumer.class);
    private static final String ALERT_TOPIC = "notification.alert";

    private final ObjectMapper objectMapper;
    private final ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider;
    private final DurableDltService durableDltService;

    public WebhookDltConsumer(
            ObjectMapper objectMapper,
            ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider,
            DurableDltService durableDltService) {
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is required");
        this.kafkaTemplateProvider = Objects.requireNonNull(kafkaTemplateProvider, "kafkaTemplateProvider is required");
        this.durableDltService = Objects.requireNonNull(durableDltService, "durableDltService is required");
    }

    @KafkaListener(topics = "payment.webhooks.dlt", groupId = "payment-dlt-alerter")
    public void onDltMessage(ConsumerRecord<String, String> record) {
        String raw = record.value();
        durableDltService.store(record, "DLT payload received", 3);
        WebhookDltEvent event;
        try {
            event = objectMapper.readValue(raw, WebhookDltEvent.class);
        } catch (Exception ex) {
            log.error("webhook-dlt-parse-error raw={} error={}", raw, ex.getMessage());
            return;
        }

        log.error("webhook-dlt-received webhookId={} provider={} eventType={} attempts={} reason={} timestamp={}",
                event.webhookId(),
                event.provider(),
                event.eventType(),
                event.attempts(),
                event.failureReason(),
                event.timestamp());
        KafkaTemplate<String, Object> kafkaTemplate = kafkaTemplateProvider.getIfAvailable();
        if (kafkaTemplate != null) {
            kafkaTemplate.send(ALERT_TOPIC, event.webhookId(), WebhookAlertEvent.fromDlt(event));
        } else {
            log.warn("webhook-dlt-alert-skipped: no KafkaTemplate for webhookId={}", event.webhookId());
        }
    }
}
