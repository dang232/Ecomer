package com.vnshop.orderservice.infrastructure.outbox;

import com.vnshop.orderservice.infrastructure.persistence.BaseJpaEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "saga_compensation_outbox", schema = "order_svc")
@Getter
@Setter
public class CompensationOutboxEventJpaEntity extends BaseJpaEntity {
    private static final int LAST_ERROR_MAX_LENGTH = 2_000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "saga_id", nullable = false)
    private String sagaId;

    @Column(name = "order_id", nullable = false)
    private String orderId;

    @Column(nullable = false)
    private String step;

    @Column(name = "operation_id", nullable = false, unique = true)
    private String operationId;

    @Column(nullable = false)
    private String topic;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CompensationOutboxEvent.Status status;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "next_attempt_at", nullable = false)
    private Instant nextAttemptAt;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    protected CompensationOutboxEventJpaEntity() {
    }

    private CompensationOutboxEventJpaEntity(
            String orderId,
            String sagaId,
            String step,
            String operationId,
            String topic,
            String payload) {
        this.orderId = orderId;
        this.sagaId = sagaId;
        this.step = step;
        this.operationId = operationId;
        this.topic = topic;
        this.payload = payload;
        this.status = CompensationOutboxEvent.Status.PENDING;
        this.attemptCount = 0;
        this.nextAttemptAt = Instant.now();
    }

    public static CompensationOutboxEventJpaEntity pending(
            String orderId,
            String sagaId,
            String step,
            String operationId,
            String topic,
            String payload) {
        return new CompensationOutboxEventJpaEntity(orderId, sagaId, step, operationId, topic, payload);
    }

    public void markPublished() {
        status = CompensationOutboxEvent.Status.PUBLISHED;
        lastError = null;
    }

    public void recordFailure(int maxAttempts, Exception cause) {
        attemptCount++;
        lastError = errorMessage(cause);
        if (attemptCount >= maxAttempts) {
            status = CompensationOutboxEvent.Status.DEAD;
            return;
        }
        nextAttemptAt = Instant.now().plusSeconds(Math.min(300, 1L << Math.min(attemptCount, 8)));
    }

    private static String errorMessage(Exception cause) {
        String message = cause.getClass().getName() + ": " + cause.getMessage();
        return message.length() <= LAST_ERROR_MAX_LENGTH
                ? message
                : message.substring(0, LAST_ERROR_MAX_LENGTH);
    }
}
