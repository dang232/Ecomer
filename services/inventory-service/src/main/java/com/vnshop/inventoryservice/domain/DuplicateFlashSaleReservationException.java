package com.vnshop.inventoryservice.domain;

/**
 * Thrown when a buyer attempts to reserve flash-sale stock for a product they
 * already have an active reservation for. Maps to HTTP 409 at the web layer.
 */
public class DuplicateFlashSaleReservationException extends RuntimeException {
    public DuplicateFlashSaleReservationException(String productId, String buyerId) {
        super("buyer " + buyerId + " already has an active reservation for product " + productId);
    }
}
