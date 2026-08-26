package com.vnshop.orderservice.domain.saga;

import java.time.Instant;
import java.util.Map;

public record SagaState(
    String sagaId,
    String orderId,
    SagaStatus currentStep,
    Instant createdAt,
    Instant updatedAt,
    Map<String, SagaStepStatus> requiredSteps
) {
    public SagaState(String sagaId, String orderId, SagaStatus currentStep, Instant createdAt, Instant updatedAt) {
        this(sagaId, orderId, currentStep, createdAt, updatedAt, Map.of());
    }
}
