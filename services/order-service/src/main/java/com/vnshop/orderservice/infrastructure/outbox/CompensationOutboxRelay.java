package com.vnshop.orderservice.infrastructure.outbox;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.KafkaException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompensationOutboxRelay {
    private static final Logger LOG = LoggerFactory.getLogger(CompensationOutboxRelay.class);

    private final CompensationOutboxRepository repository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final int batchSize;
    private final int maxAttempts;
    private final long sendTimeoutMs;

    public CompensationOutboxRelay(
            CompensationOutboxRepository repository,
            KafkaTemplate<String, String> kafkaTemplate,
            @Value("${saga.compensation-outbox.batch-size:50}") int batchSize,
            @Value("${saga.compensation-outbox.max-attempts:8}") int maxAttempts,
            @Value("${saga.compensation-outbox.send-timeout-ms:5000}") long sendTimeoutMs) {
        this.repository = repository;
        this.kafkaTemplate = kafkaTemplate;
        this.batchSize = batchSize;
        this.maxAttempts = maxAttempts;
        this.sendTimeoutMs = sendTimeoutMs;
    }

    @Scheduled(fixedDelayString = "${saga.compensation-outbox.poll-interval-ms:1000}")
    @Transactional
    public void publishPendingEvents() {
        List<CompensationOutboxEventJpaEntity> events = repository.findAndLockPendingEvents(
                Instant.now(), batchSize);
        for (CompensationOutboxEventJpaEntity event : events) {
            publishEvent(event);
        }
    }

    private void publishEvent(CompensationOutboxEventJpaEntity event) {
        try {
            kafkaTemplate.send(new ProducerRecord<>(event.getTopic(), event.getOrderId(), event.getPayload()))
                    .get(sendTimeoutMs, TimeUnit.MILLISECONDS);
            event.markPublished();
            LOG.debug("Published compensation {} for saga {}", event.getOperationId(), event.getSagaId());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            event.recordFailure(maxAttempts, new RuntimeException("Send interrupted", exception));
        } catch (java.util.concurrent.TimeoutException exception) {
            event.recordFailure(maxAttempts, exception);
        } catch (java.util.concurrent.ExecutionException exception) {
            Exception failure = exception.getCause() instanceof Exception cause ? cause : exception;
            event.recordFailure(maxAttempts, failure);
        } catch (KafkaException exception) {
            event.recordFailure(maxAttempts, exception);
        }
        repository.save(event);
    }
}
