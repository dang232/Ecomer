package com.vnshop.shippingservice.infrastructure.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.domain.model.CarrierWebhookOutboxRecord;
import com.vnshop.shippingservice.domain.port.out.CarrierWebhookOutboxPort;
import com.vnshop.shippingservice.infrastructure.config.ShippingWebhookOutboxProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
@ConditionalOnBean(JdbcTemplate.class)
public class ShippingWebhookOutboxAdapter implements CarrierWebhookOutboxPort {
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final ShippingWebhookOutboxProperties properties;

    public ShippingWebhookOutboxAdapter(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            ShippingWebhookOutboxProperties properties) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    @Override
    @Transactional
    public boolean accept(CarrierWebhookEvent event) {
        UUID id = UUID.randomUUID();
        return jdbcTemplate.update("""
                INSERT INTO shipping_svc.carrier_webhook_outbox
                    (id, carrier, event_id, order_id, tracking_code, status,
                     status_text, event_timestamp, payload, state, attempts,
                     created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, now(), now())
                ON CONFLICT (carrier, event_id) DO NOTHING
                """,
                id,
                event.carrier(),
                event.eventId(),
                event.orderId(),
                event.trackingCode(),
                event.status(),
                event.statusText(),
                event.eventTimestamp(),
                serialize(event)) == 1;
    }

    @Override
    @Transactional(readOnly = true)
    public List<CarrierWebhookOutboxRecord> findPending(int batchSize) {
        return jdbcTemplate.query("""
                SELECT id, carrier, event_id, order_id, tracking_code, status,
                       status_text, event_timestamp, attempts, next_retry_at
                  FROM shipping_svc.carrier_webhook_outbox
                 WHERE state = 'PENDING'
                   AND (next_retry_at IS NULL OR next_retry_at <= now())
                 ORDER BY created_at
                 LIMIT ?
                """, this::mapRecord, batchSize);
    }

    @Override
    @Transactional
    public boolean claim(UUID id) {
        return jdbcTemplate.update("""
                UPDATE shipping_svc.carrier_webhook_outbox
                   SET state = 'IN_FLIGHT', claimed_at = now(), updated_at = now()
                 WHERE id = ? AND state = 'PENDING'
                """, id) == 1;
    }

    @Override
    @Transactional
    public int recoverStaleClaims(Instant cutoff) {
        return jdbcTemplate.update("""
                UPDATE shipping_svc.carrier_webhook_outbox
                   SET state = 'PENDING', claimed_at = NULL, next_retry_at = now(), updated_at = now()
                 WHERE state = 'IN_FLIGHT' AND claimed_at < ?
                """, cutoff);
    }

    @Override
    @Transactional
    public void markPublished(UUID id) {
        jdbcTemplate.update("""
                UPDATE shipping_svc.carrier_webhook_outbox
                   SET state = 'PUBLISHED', claimed_at = NULL, published_at = now(), updated_at = now()
                 WHERE id = ?
                """, id);
    }

    @Override
    @Transactional
    public void recordFailure(UUID id, int attempts, Instant nextRetryAt, boolean dead, String error) {
        jdbcTemplate.update("""
                UPDATE shipping_svc.carrier_webhook_outbox
                   SET state = ?, attempts = ?, next_retry_at = ?, claimed_at = NULL, last_error = ?, updated_at = now()
                 WHERE id = ?
                """,
                dead ? "FAILED" : "PENDING",
                attempts,
                nextRetryAt,
                error == null ? "Kafka publish failed"
                        : error.substring(0, Math.min(error.length(), properties.maxErrorLength())),
                id);
    }

    private CarrierWebhookOutboxRecord mapRecord(ResultSet resultSet, int rowNumber) throws SQLException {
        CarrierWebhookEvent event = new CarrierWebhookEvent(
                resultSet.getString("event_id"),
                resultSet.getString("order_id"),
                resultSet.getString("carrier"),
                resultSet.getString("tracking_code"),
                resultSet.getString("status"),
                resultSet.getString("status_text"),
                resultSet.getString("event_timestamp"));
        return new CarrierWebhookOutboxRecord(
                resultSet.getObject("id", UUID.class),
                event,
                resultSet.getInt("attempts"),
                resultSet.getObject("next_retry_at", Instant.class));
    }

    private String serialize(CarrierWebhookEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Unable to serialize carrier webhook event", e);
        }
    }
}
