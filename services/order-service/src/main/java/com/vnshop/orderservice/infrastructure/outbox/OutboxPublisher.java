package com.vnshop.orderservice.infrastructure.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.annotation.PostConstruct;
import java.time.Instant;
import java.util.List;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OutboxPublisher {
    private static final Logger LOGGER = LoggerFactory.getLogger(OutboxPublisher.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final OutboxEventRepository repository;
    private final ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider;
    private final int batchSize;
    private final int maxAttempts;
    private final long sendTimeoutMs;

    public OutboxPublisher(
            OutboxEventRepository repository,
            ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider,
            @Value("${outbox.publisher.batch-size:50}") int batchSize,
            @Value("${outbox.publisher.max-attempts:8}") int maxAttempts,
            @Value("${outbox.publisher.send-timeout-ms:5000}") long sendTimeoutMs
    ) {
        this.repository = repository;
        this.kafkaTemplateProvider = kafkaTemplateProvider;
        this.batchSize = batchSize;
        this.maxAttempts = maxAttempts;
        this.sendTimeoutMs = sendTimeoutMs;
    }

    @PostConstruct
    void warnIfKafkaTemplateMissing() {
        if (kafkaTemplateProvider.getIfAvailable() == null) {
            LOGGER.warn("OutboxPublisher started without a KafkaTemplate bean — outbox events will accumulate as PENDING until Kafka is configured.");
        }
    }

    @Scheduled(fixedDelayString = "${outbox.publisher.poll-interval-ms:1000}")
    @Transactional
    public void publishPendingEvents() {
        KafkaTemplate<String, Object> kafkaTemplate = kafkaTemplateProvider.getIfAvailable();
        if (kafkaTemplate == null) {
            return;
        }

        List<OutboxEventJpaEntity> events = repository.findAndLockPendingEvents(
                Instant.now(),
                batchSize
        );
        for (OutboxEventJpaEntity event : events) {
            publishEvent(kafkaTemplate, event);
        }
    }

    static String topicFor(String eventType) {
        return eventType.toLowerCase().replace('_', '.');
    }

    static String keyFor(String eventType, String aggregateId, String payload) {
        if (!"SELLER_FINANCE_ADJUSTMENT".equals(eventType)) {
            return aggregateId;
        }
        try {
            JsonNode envelope = OBJECT_MAPPER.readTree(payload);
            if (envelope.path("payload").isTextual()) {
                envelope = OBJECT_MAPPER.readTree(envelope.path("payload").asText());
            }
            String sellerId = envelope.path("payload").path("sellerId").asText();
            if (sellerId == null || sellerId.isBlank()) {
                throw new IllegalArgumentException("seller.finance.adjustment is missing payload.sellerId");
            }
            return sellerId;
        } catch (java.io.IOException exception) {
            throw new IllegalArgumentException("seller.finance.adjustment payload is not valid JSON", exception);
        }
    }

    int getMaxAttempts() {
        return maxAttempts;
    }

    private void publishEvent(KafkaTemplate<String, Object> kafkaTemplate, OutboxEventJpaEntity event) {
        try {
            String topic = topicFor(event.getEventType());
            ProducerRecord<String, Object> record = propagatedRecord(topic,
                    keyFor(event.getEventType(), event.getAggregateId(), event.getPayload()), event.toDomain());
            kafkaTemplate.send(record).get(sendTimeoutMs, java.util.concurrent.TimeUnit.MILLISECONDS);
            event.markPublished();
            LOGGER.debug("Outbox event {} published to {}", event.getId(), topic);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            event.recordFailure(maxAttempts, new RuntimeException("Send interrupted", e));
            LOGGER.warn("Outbox publish interrupted for event {} (attempt {})", event.getId(), event.getAttemptCount());
        } catch (java.util.concurrent.TimeoutException e) {
            event.recordFailure(maxAttempts, e);
            LOGGER.warn("Outbox publish timed out for event {} (attempt {})", event.getId(), event.getAttemptCount());
        } catch (java.util.concurrent.ExecutionException e) {
            Exception failure = e.getCause() instanceof Exception exception ? exception : e;
            event.recordFailure(maxAttempts, failure);
            LOGGER.warn("Outbox publish failed for event {} (attempt {}): {}",
                    event.getId(), event.getAttemptCount(), failure.getMessage());
        } catch (RuntimeException e) {
            event.recordFailure(maxAttempts, e);
            LOGGER.warn("Outbox publish failed for event {} (attempt {}): {}", event.getId(), event.getAttemptCount(), e.getMessage());
        }

        // Persist explicitly so we don't depend on JPA dirty checking
        // surviving future refactors of the transaction boundary.
        repository.save(event);

        if (event.getStatus() == OutboxEvent.Status.DEAD) {
            LOGGER.error("Outbox event {} moved to DEAD after {} attempts. aggregate={} type={}",
                    event.getId(), event.getAttemptCount(), event.getAggregateId(), event.getEventType());
        }
    }

    static <K, V> ProducerRecord<K, V> propagatedRecord(String topic, K key, V value) {
        return com.vnshop.orderservice.infrastructure.observability.KafkaTracePropagation.inject(
                new ProducerRecord<>(topic, key, value));
    }
}
