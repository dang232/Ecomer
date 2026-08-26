package com.vnshop.sellerfinanceservice.infrastructure.dlt;

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
    private final DurableDltRepository repo;
    private final MeterRegistry meterRegistry;
    public DurableDltService(DurableDltRepository repo, MeterRegistry meterRegistry) { this.repo = repo; this.meterRegistry = meterRegistry; }
    @Transactional public void store(ConsumerRecord<String,String> r, String reason, int attempts) {
        String payload = r.value() == null ? "" : r.value();
        String hash = HexFormat.of().formatHex(hash(payload));
        repo.findByTopicAndPartitionAndOffsetAndPayloadHash(r.topic(), r.partition(), r.offset(), hash)
                .orElseGet(() -> repo.save(new DurableDltJpaEntity(r.topic(), r.partition(), r.offset(), r.key(), payload, hash, reason, attempts, Instant.now())));
        Counter.builder("dlt_count").tag("topic", r.topic()).register(meterRegistry).increment();
    }
    @Transactional public void replay(UUID id, KafkaTemplate<String,Object> kafka) {
        DurableDltJpaEntity entity = repo.findById(id).orElseThrow();
        if (entity.getReplayedAt() != null) throw new DurableDltReplayConflictException(id);
        Instant claimed = Instant.now();
        if (repo.claim(id, claimed, claimed.plusSeconds(60)) != 1) throw new DurableDltReplayConflictException(id);
        try {
            String topic = entity.getTopic().endsWith(".DLT") ? entity.getTopic().substring(0, entity.getTopic().length() - 4) : entity.getTopic();
            kafka.send(topic, entity.getRecordKey(), entity.getPayload()).get(10, TimeUnit.SECONDS);
            if (repo.markReplayed(id, claimed, Instant.now()) != 1) throw new DurableDltReplayConflictException(id);
        } catch (InterruptedException ex) { Thread.currentThread().interrupt(); repo.release(id, claimed); throw new IllegalStateException("DLT replay interrupted", ex);
        } catch (DurableDltReplayConflictException ex) { repo.release(id, claimed); throw ex;
        } catch (Exception ex) { repo.release(id, claimed); throw new IllegalStateException("DLT replay failed", ex); }
    }
    private static byte[] hash(String s) { try { return MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)); } catch (Exception e) { throw new IllegalStateException("SHA-256 unavailable", e); } }
}
