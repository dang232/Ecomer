package com.vnshop.recommendationsservice.infrastructure.dlt;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DurableDltService {
    private final DurableDltRepository repository;
    private final MeterRegistry meterRegistry;

    public DurableDltService(DurableDltRepository repository, MeterRegistry meterRegistry) {
        this.repository = repository;
        this.meterRegistry = meterRegistry;
    }

    @Transactional
    public UUID store(ConsumerRecord<String, String> record, String reason, int attempts) {
        String payload = record.value() == null ? "" : record.value();
        String hash = HexFormat.of().formatHex(sha256(payload));
        DurableDltJpaEntity entity = repository
                .findByTopicAndPartitionAndOffsetAndPayloadHash(record.topic(), record.partition(), record.offset(), hash)
                .orElseGet(() -> repository.save(new DurableDltJpaEntity(record.topic(), record.partition(), record.offset(),
                        record.key(), payload, hash, reason, attempts, Instant.now())));
        Counter.builder("dlt_count").tag("topic", record.topic()).register(meterRegistry).increment();
        return entity.getId();
    }

    @Transactional
    public void replay(UUID id, KafkaTemplate<String, Object> template) {
        DurableDltJpaEntity entity = repository.findById(id).orElseThrow();
        if (entity.getReplayedAt() != null) throw new DurableDltReplayConflictException(id);
        Instant claimedAt = Instant.now();
        if (repository.claim(id, claimedAt, claimedAt.plusSeconds(60)) != 1) {
            throw new DurableDltReplayConflictException(id);
        }
        try {
            template.send(baseTopic(entity.getTopic()), entity.getRecordKey(), entity.getPayload()).get(10, TimeUnit.SECONDS);
            if (repository.markReplayed(id, claimedAt, Instant.now()) != 1) {
                throw new DurableDltReplayConflictException(id);
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            repository.release(id, claimedAt);
            throw new IllegalStateException("DLT replay interrupted", exception);
        } catch (Exception exception) {
            repository.release(id, claimedAt);
            throw new IllegalStateException("DLT replay failed", exception);
        }
    }

    private static String baseTopic(String topic) {
        return topic.endsWith(".DLT") ? topic.substring(0, topic.length() - 4) : topic;
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
