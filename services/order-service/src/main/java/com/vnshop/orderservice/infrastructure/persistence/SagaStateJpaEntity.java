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
import java.util.LinkedHashMap;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
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

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "required_steps", columnDefinition = "jsonb", nullable = false)
    private Map<String, String> requiredSteps = new LinkedHashMap<>();

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
        Map<String, com.vnshop.orderservice.domain.saga.SagaStepStatus> steps = requiredSteps.entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey,
                        entry -> com.vnshop.orderservice.domain.saga.SagaStepStatus.valueOf(entry.getValue()),
                        (left, right) -> right, LinkedHashMap::new));
        return new SagaState(sagaId, orderId, currentStep, createdAt, updatedAt, steps);
    }

    public static SagaStateJpaEntity fromDomain(SagaState state) {
        var entity = new SagaStateJpaEntity();
        entity.setSagaId(state.sagaId());
        entity.setOrderId(state.orderId());
        entity.setCurrentStep(state.currentStep());
        entity.setCreatedAt(state.createdAt());
        entity.setUpdatedAt(state.updatedAt());
        entity.setRequiredSteps(toPersistenceSteps(state.requiredSteps()));
        return entity;
    }

    public void applyDomain(SagaState state) {
        this.orderId = state.orderId();
        this.currentStep = state.currentStep();
        this.updatedAt = state.updatedAt();
        this.requiredSteps = toPersistenceSteps(state.requiredSteps());
    }

    private static Map<String, String> toPersistenceSteps(Map<String, com.vnshop.orderservice.domain.saga.SagaStepStatus> steps) {
        return steps.entrySet().stream().collect(java.util.stream.Collectors.toMap(
                Map.Entry::getKey, entry -> entry.getValue().name(), (left, right) -> right, LinkedHashMap::new));
    }
}
