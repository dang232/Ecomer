package com.vnshop.paymentservice.infrastructure.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "payment.kafka.listeners.enabled", havingValue = "true", matchIfMissing = true)
public class GdprEventListener {
    private static final Logger log = LoggerFactory.getLogger(GdprEventListener.class);
    private final JdbcTemplate jdbcTemplate;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public GdprEventListener(JdbcTemplate jdbcTemplate,
                             KafkaTemplate<String, Object> kafkaTemplate,
                             ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    @SuppressWarnings("unchecked")
    @KafkaListener(topics = "gdpr.export-requested", groupId = "payment-service-gdpr")
    public void onExportRequested(String message) {
        try {
            Map<String, String> event = objectMapper.readValue(message, Map.class);
            String userId = event.get("userId");
            String requestId = event.get("requestId");
            List<Map<String, Object>> payments = jdbcTemplate.queryForList(
                    "SELECT payment_id, order_id, provider, status, amount, currency, created_at FROM payments WHERE user_id = ?",
                    userId);
            String payload = objectMapper.writeValueAsString(Map.of("payments", payments));
            kafkaTemplate.send("gdpr.export-fragment", requestId, objectMapper.writeValueAsString(
                    Map.of("requestId", requestId, "serviceName", "payment-service", "payload", payload)));
            log.info("GDPR export fragment published: requestId={}, payments={}", requestId, payments.size());
        } catch (Exception e) {
            log.error("Failed to process GDPR export request", e);
        }
    }

    @SuppressWarnings("unchecked")
    @KafkaListener(topics = "gdpr.deletion-requested", groupId = "payment-service-gdpr")
    public void onDeletionRequested(String message) {
        try {
            Map<String, String> event = objectMapper.readValue(message, Map.class);
            String userId = event.get("userId");
            int deleted = jdbcTemplate.update(
                    "DELETE FROM payment_method_refs WHERE user_id = ?", userId);
            kafkaTemplate.send("gdpr.deletion-completed", userId, objectMapper.writeValueAsString(
                    Map.of("serviceName", "payment-service", "userId", userId, "recordsAnonymized", deleted)));
            log.info("GDPR deletion: userId={}, paymentMethodRefsDeleted={}", userId, deleted);
        } catch (Exception e) {
            log.error("Failed to process GDPR deletion", e);
        }
    }
}
