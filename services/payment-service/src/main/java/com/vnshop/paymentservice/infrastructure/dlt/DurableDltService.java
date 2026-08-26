package com.vnshop.paymentservice.infrastructure.dlt;

import com.vnshop.paymentservice.application.DurableDltReplayConflictException;
import com.vnshop.paymentservice.domain.DurableDltRecord;
import com.vnshop.paymentservice.infrastructure.persistence.DurableDltJpaEntity;
import com.vnshop.paymentservice.infrastructure.persistence.DurableDltRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.scheduling.annotation.Scheduled;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class DurableDltService {
    private static final String REPLAY_TOPIC = "payment.webhooks.retry";
    private static final String DLT_SUFFIX = ".dlt";
    private static final long REPLAY_CLAIM_SECONDS = 60;
    private final DurableDltRepository repository;
    private final DurableDltReplayTransactions replayTransactions;
    private final MeterRegistry meterRegistry;
    private final AtomicLong dltAgeSeconds = new AtomicLong();

    public DurableDltService(DurableDltRepository repository) {
        this(repository, new DurableDltReplayTransactions(repository), null);
    }

    public DurableDltService(DurableDltRepository repository, DurableDltReplayTransactions replayTransactions) {
        this(repository, replayTransactions, null);
    }

    @Autowired
    public DurableDltService(DurableDltRepository repository, DurableDltReplayTransactions replayTransactions,
                             MeterRegistry meterRegistry) {
        this.repository = Objects.requireNonNull(repository, "repository is required");
        this.replayTransactions = Objects.requireNonNull(replayTransactions, "replayTransactions is required");
        this.meterRegistry = meterRegistry;
        if (meterRegistry != null) {
            io.micrometer.core.instrument.Gauge.builder("dlt_age_seconds", dltAgeSeconds, AtomicLong::doubleValue)
                    .description("Age of the oldest unreplayed payment DLT record")
                    .register(meterRegistry);
        }
    }

    @Scheduled(fixedDelayString = "${observability.metrics.poll-interval-ms:30000}")
    public void refreshDltAge() {
        if (meterRegistry == null) return;
        Instant oldest = repository.findOldestUnreplayedFirstSeen().orElse(null);
        dltAgeSeconds.set(oldest == null ? 0 : Math.max(0, Instant.now().getEpochSecond() - oldest.getEpochSecond()));
    }

    @Transactional
    public DurableDltRecord store(ConsumerRecord<String, String> record, String reason, int attempts) {
        String payload = Objects.requireNonNullElse(record.value(), "");
        String payloadHash = sha256(payload);
        DurableDltJpaEntity entity = repository
                .findByTopicAndPartitionAndOffsetAndPayloadHash(record.topic(), record.partition(), record.offset(), payloadHash)
                .orElseGet(() -> repository.save(new DurableDltJpaEntity(
                        record.topic(), record.partition(), record.offset(), record.key(), payload,
                        payloadHash, reason, attempts, Instant.now())));
        if (meterRegistry != null) {
            Counter.builder("dlt_count").tag("topic", record.topic()).register(meterRegistry).increment();
        }
        return toRecord(entity);
    }

    public DurableDltRecord replay(UUID id, KafkaTemplate<String, Object> kafkaTemplate) {
        DurableDltJpaEntity entity = repository.findById(id).orElseThrow();
        if (entity.getReplayedAt() != null) {
            throw new DurableDltReplayConflictException("DLT record has already been replayed: " + id);
        }
        Instant claimedAt = Instant.now();
        if (!replayTransactions.claim(id, claimedAt, claimedAt.plusSeconds(REPLAY_CLAIM_SECONDS))) {
            return repository.findById(id).map(this::toRecord).orElseThrow();
        }
        try {
            kafkaTemplate.send(replayTopic(entity.getTopic()), entity.getRecordKey(), entity.getPayload())
                    .get(10, TimeUnit.SECONDS);
            if (!replayTransactions.markReplayed(id, claimedAt, Instant.now())) {
                throw new IllegalStateException("DLT replay claim was lost before completion");
            }
        } catch (TimeoutException exception) {
            throw new IllegalStateException("DLT replay publication timed out; lease retained", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            replayTransactions.release(id, claimedAt);
            throw new IllegalStateException("DLT replay publication failed", exception);
        } catch (ExecutionException | RuntimeException exception) {
            replayTransactions.release(id, claimedAt);
            throw new IllegalStateException("DLT replay publication failed", exception);
        }
        return repository.findById(id).map(this::toRecord).orElseThrow();
    }

    private static String replayTopic(String dltTopic) {
        if ("payment.webhooks.dlt".equals(dltTopic)) return REPLAY_TOPIC;
        return dltTopic.endsWith(DLT_SUFFIX)
                ? dltTopic.substring(0, dltTopic.length() - DLT_SUFFIX.length())
                : dltTopic;
    }

    private DurableDltRecord toRecord(DurableDltJpaEntity entity) {
        return new DurableDltRecord(entity.getId(), entity.getTopic(), entity.getPartition(), entity.getOffset(),
                entity.getRecordKey(), entity.getPayload(), entity.getPayloadHash(), entity.getReason(),
                entity.getAttempts(), entity.getFirstSeen(), entity.getReplayedAt());
    }

    private static String sha256(String payload) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
