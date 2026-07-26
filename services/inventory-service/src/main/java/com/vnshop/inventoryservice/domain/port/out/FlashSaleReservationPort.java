package com.vnshop.inventoryservice.domain.port.out;

import com.vnshop.inventoryservice.domain.FlashSaleReservation;
import com.vnshop.inventoryservice.domain.DuplicateFlashSaleReservationException;
import java.util.Optional;
import java.util.UUID;

public interface FlashSaleReservationPort {
	record IdempotentReservation(FlashSaleReservation reservation, boolean replay) {}

	default boolean reserve(String productId, String buyerId, int quantity) {
		return reserve(productId, buyerId, quantity, UUID.randomUUID());
	}

	default IdempotentReservation reserveIdempotently(
			String productId, String buyerId, int quantity, String idempotencyKey, String requestHash) {
		if (idempotencyKey == null || idempotencyKey.isBlank() || requestHash == null || requestHash.isBlank()) {
			throw new IllegalArgumentException("idempotency key and request hash are required");
		}
		if (hasActiveReservation(productId, buyerId)) {
			throw new DuplicateFlashSaleReservationException(productId, buyerId);
		}
		UUID reservationId = UUID.randomUUID();
		java.time.Instant reservedAt = java.time.Instant.now();
		boolean reserved = reserve(productId, buyerId, quantity, reservationId);
		FlashSaleReservation reservation = new FlashSaleReservation(
				reserved ? reservationId : null, productId, buyerId, quantity,
				reserved ? FlashSaleReservation.Status.RESERVED : FlashSaleReservation.Status.REJECTED,
				reservedAt, reservedAt.plus(java.time.Duration.ofMinutes(15)));
		if (reserved) {
			save(reservation);
		}
		return new IdempotentReservation(reservation, false);
	}

	boolean reserve(String productId, String buyerId, int quantity, UUID reservationId);

	void save(FlashSaleReservation reservation);

	Optional<FlashSaleReservation> findById(UUID reservationId);

	void release(UUID reservationId);

	long getStock(String productId);

	boolean hasActiveReservation(String productId, String buyerId);
}
