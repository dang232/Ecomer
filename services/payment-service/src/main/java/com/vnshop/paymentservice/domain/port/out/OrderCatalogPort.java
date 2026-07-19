package com.vnshop.paymentservice.domain.port.out;

import com.vnshop.paymentservice.domain.OrderSnapshot;

import java.util.Optional;

/**
 * Reads canonical order details (buyer, final amount, status) from the
 * order-service. Used by the payment create-path to gate every gateway
 * charge: the BE-side {@code finalAmount} replaces any client-claimed
 * amount, and {@code buyerId} must match the authenticated principal.
 *
 * <p>Closes the price-tampering finding documented in
 * {@code docs/SESSION-HANDOVER-2026-05-20-pt12.md}.
 */
public interface OrderCatalogPort {
    Optional<OrderSnapshot> findByOrderId(String orderId);
}
