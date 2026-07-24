package com.vnshop.paymentservice.infrastructure.event;

import com.vnshop.paymentservice.domain.FinancialEventOutboxRecord;
import com.vnshop.paymentservice.domain.port.out.FinancialEventOutboxPort;
import jakarta.annotation.PostConstruct;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class FinancialEventOutboxRelay {
    private static final Logger LOGGER = LoggerFactory.getLogger(FinancialEventOutboxRelay.class);
    private static final int MAX_ATTEMPTS = 8;

    private final FinancialEventOutboxPort outbox;
    private final ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider;
    private final int batchSize;
    private final long sendTimeoutMs;

    public FinancialEventOutboxRelay(
            FinancialEventOutboxPort outbox,
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
            LOGGER.warn("FinancialEventOutboxRelay started without KafkaTemplate; events will remain pending");
        }
    }

    @Scheduled(fixedDelayString = "${payment.outbox.poll-interval-ms:1000}")
    public void publishPending() {
        KafkaTemplate<String, Object> kafka = kafkaTemplateProvider.getIfAvailable();
        if (kafka == null) return;
        for (FinancialEventOutboxRecord record : outbox.findRetryable(batchSize, Instant.now())) {
            publish(kafka, record);
        }
    }

    private void publish(KafkaTemplate<String, Object> kafka, FinancialEventOutboxRecord record) {
        try {
            kafka.send(topicFor(record.eventType()), record.aggregateId(), record.payload())
                    .get(sendTimeoutMs, TimeUnit.MILLISECONDS);
            outbox.markPublished(record.id(), Instant.now());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            recordFailure(record, exception);
        } catch (Exception exception) {
            recordFailure(record, exception);
        }
    }

    static String topicFor(String eventType) {
        return switch (eventType) {
            case "CHARGEBACK_RESOLVED" -> "payment.chargeback.resolved";
            default -> throw new IllegalArgumentException("unsupported financial event type " + eventType);
        };
    }

    private void recordFailure(FinancialEventOutboxRecord record, Exception exception) {
        int attempts = record.attemptCount() + 1;
        boolean dead = attempts >= MAX_ATTEMPTS;
        Instant nextAttempt = dead ? null : Instant.now().plusSeconds(Math.min(1L << attempts, 300L));
        outbox.recordFailure(record.id(), attempts, exception.getMessage(), nextAttempt, dead);
        LOGGER.warn("financial-event-outbox delivery failed id={} attempt={} dead={}",
                record.id(), attempts, dead, exception);
    }
}
