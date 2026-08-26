package com.vnshop.paymentservice.application;

public class DurableDltReplayConflictException extends RuntimeException {
    public DurableDltReplayConflictException(String message) {
        super(message);
    }
}
