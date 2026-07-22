package com.vnshop.productservice.infrastructure.persistence.review;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(schema = "product_svc", name = "product_rating_projection_backfill")
public class ProductRatingProjectionBackfillJpaEntity {
    @Id
    @Column(name = "id")
    private short id;

    @Column(name = "completed_at")
    private Instant completedAt;

    protected ProductRatingProjectionBackfillJpaEntity() {
    }

    public ProductRatingProjectionBackfillJpaEntity(short id) {
        this.id = id;
    }

    public boolean isCompleted() {
        return completedAt != null;
    }

    public void markCompleted() {
        completedAt = Instant.now();
    }
}
