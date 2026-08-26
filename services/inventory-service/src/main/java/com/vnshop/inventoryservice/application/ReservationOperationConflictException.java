package com.vnshop.inventoryservice.application;

public class ReservationOperationConflictException extends RuntimeException {
    public ReservationOperationConflictException(String operationId) {
        super("operation_id reused with a different reservation request: " + operationId);
    }
}
