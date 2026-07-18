package com.vnshop.inventoryservice.application;

import com.vnshop.inventoryservice.domain.FlashSaleReservation;
import com.vnshop.inventoryservice.domain.FlashSaleReservation.Status;
import com.vnshop.inventoryservice.domain.port.out.FlashSaleReservationPort;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

public class ReserveFlashSaleUseCase {
	private static final Duration RESERVATION_TTL = Duration.ofMinutes(15);

	private final FlashSaleReservationPort reservationPort;
	private final Clock clock;

	public ReserveFlashSaleUseCase(FlashSaleReservationPort reservationPort) {
		this(reservationPort, Clock.systemUTC());
	}

	ReserveFlashSaleUseCase(FlashSaleReservationPort reservationPort, Clock clock) {
		this.reservationPort = reservationPort;
		this.clock = clock;
	}

	public ReserveFlashSaleResult reserve(ReserveFlashSaleCommand command) {
		FlashSaleReservation reservation = reserveReservation(command);
		if (reservation.getStatus() == Status.REJECTED) {
			throw new FlashSaleOutOfStockException(command.productId());
		}
		String reservationId = reservation.getReservationId() == null ? null : reservation.getReservationId().toString();
		return new ReserveFlashSaleResult(
				reservationId,
				reservation.getStatus().name(),
				reservation.getExpiresAt().toString());
	}

	FlashSaleReservation reserveReservation(ReserveFlashSaleCommand command) {
		Instant reservedAt = clock.instant();
		FlashSaleReservation reservation = reservationPort.reserveIdempotently(
				command.productId(), command.buyerId(), command.quantity(),
				command.idempotencyKey(), command.requestHash()).reservation();
		if (reservation.getReservedAt() == null) {
			reservation.setReservedAt(reservedAt);
			reservation.setExpiresAt(reservedAt.plus(RESERVATION_TTL));
		}
		return reservation;
	}

	public void release(UUID reservationId, String callerId) {
		FlashSaleReservation reservation = reservationPort.findById(reservationId).orElse(null);
		if (reservation == null) {
			// Idempotent: releasing a non-existent reservation is a no-op for the
			// caller. Returning quietly avoids leaking which reservation ids exist.
			return;
		}
		if (!reservation.getBuyerId().equals(callerId)) {
			throw new FlashSaleAccessDeniedException(
					"reservation " + reservationId + " not owned by caller");
		}
		reservationPort.release(reservationId);
	}

	public long getStock(String productId) {
		return reservationPort.getStock(productId);
	}
}
