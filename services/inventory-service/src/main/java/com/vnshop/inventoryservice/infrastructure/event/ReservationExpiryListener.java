package com.vnshop.inventoryservice.infrastructure.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Listens for Redis keyspace expiry notifications on {@code flash:reservation:*}
 * keys and publishes an {@code inventory.reservation-expired} Kafka event so
 * downstream consumers can react (e.g. release held stock, notify the buyer).
 *
 * <p>Requires Redis keyspace notifications to be enabled:
 * {@code notify-keyspace-events "Ex"} (expired events on key-space channel).
 * This is configured via {@link RedisKeyspaceNotificationConfig}.
 */
@Component
public class ReservationExpiryListener implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(ReservationExpiryListener.class);
    private static final String RESERVATION_KEY_PREFIX = "vnshop:flash-sale:v1:reservation:";
    private static final String TOPIC_RESERVATION_EXPIRED = "inventory.reservation-expired";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public ReservationExpiryListener(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String expiredKey = new String(message.getBody());
        if (!expiredKey.startsWith(RESERVATION_KEY_PREFIX)) {
            return;
        }
        String reservationId = expiredKey.substring(RESERVATION_KEY_PREFIX.length());
        log.info("Redis key expired: reservationId={}", reservationId);
        publishExpired(reservationId);
    }

    private void publishExpired(String reservationId) {
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                "reservationId", reservationId,
                "timestamp", Instant.now().toString()
            ));
            kafkaTemplate.send(TOPIC_RESERVATION_EXPIRED, reservationId, payload);
            log.info("Published inventory.reservation-expired for reservationId={}", reservationId);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize reservation-expired event for " + reservationId, e);
        }
    }
}
