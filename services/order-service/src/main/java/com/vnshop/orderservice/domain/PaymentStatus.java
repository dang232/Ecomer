package com.vnshop.orderservice.domain;

public enum PaymentStatus {
    PENDING,
    AWAITING_COLLECTION,
    COMPLETED,
    FAILED,
    FLAGGED,
    DISPUTED
}
