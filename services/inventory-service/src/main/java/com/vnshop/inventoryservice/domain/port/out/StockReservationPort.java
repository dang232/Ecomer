package com.vnshop.inventoryservice.domain.port.out;

import com.vnshop.inventoryservice.domain.StockReservation;
import java.util.List;

/**
 * Persistence port for the gRPC Reserve/Release workflow.
 *
 * <p>Implementations are expected to honour single-row atomicity for
 * {@link #tryDecrement(String, int)}: success means the row existed AND the
 * available quantity was at least {@code quantity}. If no row exists for the
 * product, callers should treat it as "not yet projected" and skip the
 * decrement (the gRPC handler logs a structured warning in that case).
 */
public interface StockReservationPort {
    /**
     * Atomically decrement projected stock if a row exists and has enough.
     *
     * @return {@link DecrementOutcome#APPLIED} on success,
     *         {@link DecrementOutcome#INSUFFICIENT} if the row exists but
     *         doesn't have enough quantity, or
     *         {@link DecrementOutcome#NOT_PROJECTED} if no row exists yet.
     */
    DecrementOutcome tryDecrement(String productId, int quantity);

    /** Add quantity back to projected stock. Creates the row if needed. */
    void increment(String productId, int quantity);

    /**
     * Batch release: add quantities back to projected stock in a single operation.
     * Key = productId, Value = quantity to add back.
     */
    void incrementBatch(java.util.Map<String, Integer> productQuantities);

    /**
     * Batch release: mark multiple reservations as RELEASED in a single UPDATE.
     * @param reservationIds List of reservation IDs to mark as released
     * @param releasedAt Timestamp of release
     */
    void batchMarkReleased(java.util.List<java.util.UUID> reservationIds, java.time.Instant releasedAt);

    void saveReservation(StockReservation reservation);

    List<StockReservation> findActiveReservationsByOrderId(String orderId);

    void markReleased(StockReservation reservation);

    enum DecrementOutcome {
        APPLIED,
        INSUFFICIENT,
        NOT_PROJECTED
    }
}
