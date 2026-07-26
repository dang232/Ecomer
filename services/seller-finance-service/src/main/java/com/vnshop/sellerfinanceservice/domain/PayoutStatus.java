package com.vnshop.sellerfinanceservice.domain;

public enum PayoutStatus {
    REQUESTED,
    APPROVED,
    SUBMITTING,
    SUBMITTED,
    PAID,
    UNKNOWN,
    REJECTED,
    CANCELLED,
    REVERSED,
    /** Legacy status retained for clients and rows created before V10. */
    PENDING,
    /** Legacy status retained for clients and rows created before V10. */
    COMPLETED,
    /** Legacy status retained for clients and rows created before V10. */
    FAILED
}
