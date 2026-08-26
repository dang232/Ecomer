package com.vnshop.paymentservice.application;

public class IdempotencyRequestInProgressException extends RuntimeException {
    public IdempotencyRequestInProgressException(String message) {
        super(message);
    }
}
