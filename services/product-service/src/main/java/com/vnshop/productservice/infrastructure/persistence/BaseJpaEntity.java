package com.vnshop.productservice.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import java.time.Instant;

@MappedSuperclass
public abstract class BaseJpaEntity {
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

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

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    /**
     * Keeps an audit timestamp when a domain object is converted back into a
     * detached entity for an update. Spring Data uses merge for entities with
     * assigned identifiers, so leaving createdAt unset would erase it before
     * the managed entity is flushed.
     */
    protected void restoreCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
