package com.vnshop.orderservice.infrastructure.outbox;

public final class CompensationOutboxEvent {
    private CompensationOutboxEvent() {
    }

    public enum Status {
        PENDING,
        PUBLISHED,
        DEAD
    }
}
