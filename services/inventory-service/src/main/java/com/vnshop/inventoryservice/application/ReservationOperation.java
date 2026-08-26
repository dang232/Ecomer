package com.vnshop.inventoryservice.application;

import java.time.Instant;

public record ReservationOperation(
        String operationId,
        String requestHash,
        boolean success,
        int reservedItems,
        ReservationStatus status,
        ReservationFailureCode failureCode,
        Instant processedAt
) {
    public enum ReservationStatus {
        RESERVED,
        REJECTED,
        CONFLICT
    }

    public enum ReservationFailureCode {
        NONE,
        INSUFFICIENT_STOCK,
        NOT_PROJECTED,
        OPERATION_CONFLICT
    }
}
