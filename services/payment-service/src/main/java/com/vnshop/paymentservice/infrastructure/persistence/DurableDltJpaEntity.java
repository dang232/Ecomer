package com.vnshop.paymentservice.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "dlt_store", schema = "payment_svc")
@Getter
@Setter
@NoArgsConstructor
public class DurableDltJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false) private String topic;
    @Column(nullable = false) private int partition;
    @Column(name = "kafka_offset", nullable = false) private long offset;
    private String recordKey;
    @Column(nullable = false, columnDefinition = "TEXT") private String payload;
    @Column(nullable = false, length = 64) private String payloadHash;
    @Column(nullable = false, columnDefinition = "TEXT") private String reason;
    @Column(nullable = false) private int attempts;
    @Column(nullable = false) private Instant firstSeen;
    private Instant replayedAt;
    private Instant replayClaimedAt;
    private Instant replayClaimedUntil;

    public DurableDltJpaEntity(String topic, int partition, long offset, String recordKey,
                               String payload, String payloadHash, String reason, int attempts,
                               Instant firstSeen) {
        this.topic = topic;
        this.partition = partition;
        this.offset = offset;
        this.recordKey = recordKey;
        this.payload = payload;
        this.payloadHash = payloadHash;
        this.reason = reason;
        this.attempts = attempts;
        this.firstSeen = firstSeen;
    }

    public UUID getId() { return id; }
    public String getTopic() { return topic; }
    public int getPartition() { return partition; }
    public long getOffset() { return offset; }
    public String getRecordKey() { return recordKey; }
    public String getPayload() { return payload; }
    public String getPayloadHash() { return payloadHash; }
    public String getReason() { return reason; }
    public int getAttempts() { return attempts; }
    public Instant getFirstSeen() { return firstSeen; }
    public Instant getReplayedAt() { return replayedAt; }
}
