package com.vnshop.paymentservice.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(schema = "payment_svc", name = "pending_webhooks")
public class PendingWebhookJpaEntity {

    @Id
    @Column(name = "id", nullable = false, columnDefinition = "uuid")
    private UUID id;

    @Column(name = "webhook_id", nullable = false, length = 255)
    private String webhookId;

    @Column(name = "provider", nullable = false, length = 32)
    private String provider;

    @Column(name = "event_type", nullable = false, length = 128)
    private String eventType;

    @Column(name = "payload", nullable = false, columnDefinition = "text")
    private String payload;

    @Column(name = "attempts", nullable = false)
    private int attempts = 0;

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts = 3;

    @Column(name = "next_retry_at")
    private Instant nextRetryAt;

    @Column(name = "status", nullable = false, length = 16)
    private String status = "PENDING";

    @Column(name = "lease_token", columnDefinition = "uuid")
    private UUID leaseToken;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PendingWebhookJpaEntity() {
    }

    public PendingWebhookJpaEntity(String webhookId, String provider, String eventType, String payload) {
        this.id = UUID.randomUUID();
        this.webhookId = Objects.requireNonNull(webhookId, "webhookId is required");
        this.provider = Objects.requireNonNull(provider, "provider is required");
        this.eventType = Objects.requireNonNull(eventType, "eventType is required");
        this.payload = Objects.requireNonNull(payload, "payload is required");
    }

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getWebhookId() { return webhookId; }
    public String getProvider() { return provider; }
    public String getEventType() { return eventType; }
    public String getPayload() { return payload; }
    public int getAttempts() { return attempts; }
    public int getMaxAttempts() { return maxAttempts; }
    public Instant getNextRetryAt() { return nextRetryAt; }
    public String getStatus() { return status; }
    public UUID getLeaseToken() { return leaseToken; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void setAttempts(int attempts) { this.attempts = attempts; }
    public void setNextRetryAt(Instant nextRetryAt) { this.nextRetryAt = nextRetryAt; }
    public void setStatus(String status) { this.status = status; }
    public void setLeaseToken(UUID leaseToken) { this.leaseToken = leaseToken; }
}
