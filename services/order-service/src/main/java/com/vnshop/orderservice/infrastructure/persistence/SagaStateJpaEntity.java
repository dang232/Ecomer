package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.saga.SagaState;
import com.vnshop.orderservice.domain.saga.SagaStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(schema = "order_svc", name = "saga_state")
@Getter @Setter
public class SagaStateJpaEntity {
    @Id
    @Column(name = "saga_id", length = 36, nullable = false)
    private String sagaId;

    @Column(name = "order_id", length = 36, nullable = false)
    private String orderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "current_step", length = 30, nullable = false)
    private SagaStatus currentStep;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) this.createdAt = now;
        if (this.updatedAt == null) this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    protected SagaStateJpaEntity() {}

    public SagaState toDomain() {
        return new SagaState(sagaId, orderId, currentStep, createdAt, updatedAt);
    }

    public static SagaStateJpaEntity fromDomain(SagaState state) {
        var entity = new SagaStateJpaEntity();
        entity.setSagaId(state.sagaId());
        entity.setOrderId(state.orderId());
        entity.setCurrentStep(state.currentStep());
        entity.setCreatedAt(state.createdAt());
        entity.setUpdatedAt(state.updatedAt());
        return entity;
    }

    public void applyDomain(SagaState state) {
        this.orderId = state.orderId();
        this.currentStep = state.currentStep();
        this.updatedAt = state.updatedAt();
    }
}