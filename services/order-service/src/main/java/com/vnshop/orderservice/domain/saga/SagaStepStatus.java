package com.vnshop.orderservice.domain.saga;

public enum SagaStepStatus {
    REQUESTED,
    COMPLETED,
    FAILED,
    TIMED_OUT
}
