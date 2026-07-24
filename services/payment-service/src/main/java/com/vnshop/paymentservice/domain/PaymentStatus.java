package com.vnshop.paymentservice.domain;

public enum PaymentStatus {
    PENDING,
    AWAITING_COLLECTION,
    COMPLETED,
    FAILED,
    PARTIALLY_REFUNDED,
    REFUNDED,
    /** VietQR payment where no bank credit arrived within the configured timeout window. */
    PAYMENT_TIMEOUT
}
