package com.vnshop.inventoryservice.application;

public class FlashSaleIdempotencyConflictException extends RuntimeException {
    public FlashSaleIdempotencyConflictException(String idempotencyKey) {
        super("idempotency key was already used with a different request: " + idempotencyKey);
    }
}
