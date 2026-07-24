package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.domain.FinancialEventOutboxRecord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(schema = "payment_svc", name = "financial_event_outbox")
public class FinancialEventOutboxJpaEntity extends BaseJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false, unique = true, columnDefinition = "uuid")
    private UUID eventId;

    @Column(name = "event_type", nullable = false, length = 96)
    private String eventType;

    @Column(name = "aggregate_id", nullable = false, length = 128)
    private String aggregateId;

    @Column(name = "payload", nullable = false, columnDefinition = "text")
    private String payload;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "next_attempt_at")
    private Instant nextAttemptAt;

    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;

    @Column(name = "dead", nullable = false)
    private boolean dead;

    static FinancialEventOutboxJpaEntity fromRecord(FinancialEventOutboxRecord record) {
        FinancialEventOutboxJpaEntity entity = new FinancialEventOutboxJpaEntity();
        entity.id = record.id();
        entity.eventId = record.eventId();
        entity.eventType = record.eventType();
        entity.aggregateId = record.aggregateId();
        entity.payload = record.payload();
        entity.publishedAt = record.publishedAt();
        entity.attemptCount = record.attemptCount();
        entity.nextAttemptAt = record.nextAttemptAt();
        entity.lastError = record.lastError();
        entity.dead = record.dead();
        return entity;
    }

    FinancialEventOutboxRecord toRecord() {
        return new FinancialEventOutboxRecord(id, eventId, eventType, aggregateId, payload,
                getCreatedAt(), publishedAt, attemptCount, nextAttemptAt, lastError, dead);
    }

    Instant getPublishedAt() { return publishedAt; }
    void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
    void setAttemptCount(int attemptCount) { this.attemptCount = attemptCount; }
    void setLastError(String lastError) { this.lastError = lastError; }
    void setNextAttemptAt(Instant nextAttemptAt) { this.nextAttemptAt = nextAttemptAt; }
    void setDead(boolean dead) { this.dead = dead; }
}
