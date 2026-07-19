package com.vnshop.paymentservice.domain;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * Snapshot of an order's authoritative state, sourced from order-service.
 * Used by {@link com.vnshop.paymentservice.application.ProcessPaymentUseCase}
 * to gate every gateway charge: the BE-side {@code finalAmount} replaces
 * any client-claimed amount, and {@code buyerId} must match the
 * authenticated principal.
 */
public record OrderSnapshot(
        String orderId,
        String buyerId,
        BigDecimal finalAmount,
        String currency,
        String paymentStatus
) {
    public OrderSnapshot {
        Objects.requireNonNull(orderId, "orderId is required");
        Objects.requireNonNull(buyerId, "buyerId is required");
        Objects.requireNonNull(finalAmount, "finalAmount is required");
    }

    /** PENDING is the only payable status; everything else (COMPLETED, FAILED, REFUNDED) is closed. */
    public boolean isPayable() {
        return "PENDING".equalsIgnoreCase(paymentStatus);
    }
}
