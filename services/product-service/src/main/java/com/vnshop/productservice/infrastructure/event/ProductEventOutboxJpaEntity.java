package com.vnshop.productservice.infrastructure.event;

import com.vnshop.productservice.infrastructure.persistence.BaseJpaEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;

@Entity
@Table(schema = "product_svc", name = "product_event_outbox")
@Getter
class ProductEventOutboxJpaEntity extends BaseJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private String productId;

    @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
    private String payload;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "next_attempt_at", nullable = false)
    private Instant nextAttemptAt;

    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;

    @Column(name = "dead", nullable = false)
    private boolean dead;

    protected ProductEventOutboxJpaEntity() {
    }

    ProductEventOutboxJpaEntity(String productId, String payload) {
        this.productId = productId;
        this.payload = payload;
        this.nextAttemptAt = Instant.now();
    }

    void markPublished() {
        publishedAt = Instant.now();
        lastError = null;
    }

    void recordFailure(int maxAttempts, Exception failure) {
        attemptCount++;
        lastError = failure.getClass().getSimpleName() + ": " + failure.getMessage();
        if (attemptCount >= maxAttempts) {
            dead = true;
        } else {
            nextAttemptAt = Instant.now().plusSeconds(Math.min(300, 1L << Math.min(attemptCount, 8)));
        }
    }
}
