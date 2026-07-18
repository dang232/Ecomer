package com.vnshop.inventoryservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.inventoryservice.domain.FlashSaleReservation;
import com.vnshop.inventoryservice.domain.port.out.FlashSaleReservationPort;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.Test;

class ReserveFlashSaleUseCaseTest {

	@Test
	void replaysSameIdempotencyKeyWithoutDecrementingStockTwice() {
		var port = new AtomicInMemoryFlashSaleReservationPort(1);
		var useCase = new ReserveFlashSaleUseCase(port);
		var firstCommand = new ReserveFlashSaleCommand("product-1", "buyer-1", 1, "key-1", "hash-1");

		ReserveFlashSaleResult first = useCase.reserve(firstCommand);
		ReserveFlashSaleResult replay = useCase.reserve(firstCommand);

		assertThat(replay.reservationId()).isEqualTo(first.reservationId());
		assertThat(port.stock()).isZero();
	}

	@Test
	void rejectsSameIdempotencyKeyWithDifferentRequestBody() {
		var port = new AtomicInMemoryFlashSaleReservationPort(3);
		var useCase = new ReserveFlashSaleUseCase(port);
		useCase.reserve(new ReserveFlashSaleCommand("product-1", "buyer-1", 1, "key-1", "hash-1"));

		assertThatThrownBy(() -> useCase.reserve(new ReserveFlashSaleCommand(
				"product-1", "buyer-1", 2, "key-1", "hash-2")))
				.isInstanceOf(FlashSaleIdempotencyConflictException.class);
	}

	@Test
	void mapsOutOfStockToConflictInsteadOfRejectedSuccess() {
		var useCase = new ReserveFlashSaleUseCase(new AtomicInMemoryFlashSaleReservationPort(0));

		assertThatThrownBy(() -> useCase.reserve(new ReserveFlashSaleCommand(
				"product-1", "buyer-1", 1, "key-1", "hash-1")))
				.isInstanceOf(FlashSaleOutOfStockException.class);
	}

	@Test
	void returnsReservationWhenRedisReservesStock() {
		var port = new InMemoryFlashSaleReservationPort(true, 5);
		var useCase = new ReserveFlashSaleUseCase(port);

		FlashSaleReservation reservation = useCase.reserveReservation(new ReserveFlashSaleCommand("product-1", "buyer-1", 2));

		assertThat(reservation.getStatus()).isEqualTo(FlashSaleReservation.Status.RESERVED);
		assertThat(reservation.getProductId()).isEqualTo("product-1");
		assertThat(reservation.getBuyerId()).isEqualTo("buyer-1");
		assertThat(reservation.getQuantity()).isEqualTo(2);
		assertThat(reservation.getReservationId()).isNotNull();
		assertThat(reservation.getExpiresAt()).isAfter(reservation.getReservedAt());
	}

	@Test
	void returnsRejectedReservationWhenRedisRejectsStock() {
		var port = new InMemoryFlashSaleReservationPort(false, 0);
		var useCase = new ReserveFlashSaleUseCase(port);

		FlashSaleReservation reservation = useCase.reserveReservation(new ReserveFlashSaleCommand("product-1", "buyer-1", 2));

		assertThat(reservation.getStatus()).isEqualTo(FlashSaleReservation.Status.REJECTED);
		assertThat(reservation.getReservationId()).isNull();
	}

	@Test
	void releaseOwnedReservationCallsPort() {
		var port = new InMemoryFlashSaleReservationPort(true, 5);
		var useCase = new ReserveFlashSaleUseCase(port);
		UUID reservationId = UUID.randomUUID();
		port.save(new FlashSaleReservation(reservationId, "product-1", "buyer-1", 1,
				FlashSaleReservation.Status.RESERVED, Instant.now(), Instant.now().plusSeconds(900)));

		useCase.release(reservationId, "buyer-1");

		assertThat(port.released).containsExactly(reservationId);
	}

	@Test
	void releaseByWrongCallerThrowsAccessDenied() {
		var port = new InMemoryFlashSaleReservationPort(true, 5);
		var useCase = new ReserveFlashSaleUseCase(port);
		UUID reservationId = UUID.randomUUID();
		port.save(new FlashSaleReservation(reservationId, "product-1", "buyer-1", 1,
				FlashSaleReservation.Status.RESERVED, Instant.now(), Instant.now().plusSeconds(900)));

		assertThatThrownBy(() -> useCase.release(reservationId, "buyer-2"))
				.isInstanceOf(FlashSaleAccessDeniedException.class);
		assertThat(port.released).isEmpty();
	}

	@Test
	void releaseUnknownReservationIsSilentNoOp() {
		var port = new InMemoryFlashSaleReservationPort(true, 5);
		var useCase = new ReserveFlashSaleUseCase(port);

		useCase.release(UUID.randomUUID(), "buyer-1");

		assertThat(port.released).isEmpty();
	}

	@Test
	void throwsDuplicateExceptionWhenBuyerAlreadyHasActiveReservation() {
		var port = new InMemoryFlashSaleReservationPort(true, 5);
		port.activeReservations.add("product-1:buyer-1");
		var useCase = new ReserveFlashSaleUseCase(port);

		assertThatThrownBy(() -> useCase.reserveReservation(new ReserveFlashSaleCommand("product-1", "buyer-1", 1)))
				.isInstanceOf(DuplicateFlashSaleReservationException.class);
	}

	@Test
	void allowsReservationWhenBuyerHasNoActiveReservationForProduct() {
		var port = new InMemoryFlashSaleReservationPort(true, 5);
		port.activeReservations.add("product-1:buyer-2");
		var useCase = new ReserveFlashSaleUseCase(port);

		FlashSaleReservation reservation = useCase.reserveReservation(new ReserveFlashSaleCommand("product-1", "buyer-1", 1));

		assertThat(reservation.getStatus()).isEqualTo(FlashSaleReservation.Status.RESERVED);
	}

	private static final class InMemoryFlashSaleReservationPort implements FlashSaleReservationPort {
		private final boolean reserveResult;
		private final long stock;
		private final Map<UUID, FlashSaleReservation> reservations = new ConcurrentHashMap<>();
		final java.util.List<UUID> released = new java.util.ArrayList<>();
		final Set<String> activeReservations = ConcurrentHashMap.newKeySet();

		private InMemoryFlashSaleReservationPort(boolean reserveResult, long stock) {
			this.reserveResult = reserveResult;
			this.stock = stock;
		}

		@Override
		public boolean reserve(String productId, String buyerId, int quantity, UUID reservationId) {
			return reserveResult;
		}

		@Override
		public void save(FlashSaleReservation reservation) {
			reservations.put(reservation.getReservationId(), reservation);
		}

		@Override
		public Optional<FlashSaleReservation> findById(UUID reservationId) {
			return Optional.ofNullable(reservations.get(reservationId));
		}

		@Override
		public void release(UUID reservationId) {
			released.add(reservationId);
		}

		@Override
		public long getStock(String productId) {
			return stock;
		}

		@Override
		public boolean hasActiveReservation(String productId, String buyerId) {
			return activeReservations.contains(productId + ":" + buyerId);
		}
	}

	private static final class AtomicInMemoryFlashSaleReservationPort implements FlashSaleReservationPort {
		private final Map<String, FlashSaleReservation> byKey = new ConcurrentHashMap<>();
		private final Map<String, String> hashes = new ConcurrentHashMap<>();
		private final Set<String> active = ConcurrentHashMap.newKeySet();
		private long remainingStock;

		private AtomicInMemoryFlashSaleReservationPort(long remainingStock) {
			this.remainingStock = remainingStock;
		}

		@Override
		public synchronized IdempotentReservation reserveIdempotently(
				String productId, String buyerId, int quantity, String idempotencyKey, String requestHash) {
			String key = productId + ":" + buyerId + ":" + idempotencyKey;
			FlashSaleReservation existing = byKey.get(key);
			if (existing != null) {
				if (!requestHash.equals(hashes.get(key))) {
					throw new FlashSaleIdempotencyConflictException(idempotencyKey);
				}
				return new IdempotentReservation(existing, true);
			}
			if (active.contains(productId + ":" + buyerId)) {
				throw new DuplicateFlashSaleReservationException(productId, buyerId);
			}
			Instant now = Instant.now();
			if (remainingStock < quantity) {
				return new IdempotentReservation(new FlashSaleReservation(null, productId, buyerId, quantity,
						FlashSaleReservation.Status.REJECTED, now, now.plusSeconds(900)), false);
			}
			remainingStock -= quantity;
			FlashSaleReservation reservation = new FlashSaleReservation(UUID.randomUUID(), productId, buyerId, quantity,
					FlashSaleReservation.Status.RESERVED, now, now.plusSeconds(900));
			byKey.put(key, reservation);
			hashes.put(key, requestHash);
			active.add(productId + ":" + buyerId);
			return new IdempotentReservation(reservation, false);
		}

		long stock() { return remainingStock; }

		@Override public boolean reserve(String productId, String buyerId, int quantity, UUID reservationId) { return false; }
		@Override public void save(FlashSaleReservation reservation) { }
		@Override public Optional<FlashSaleReservation> findById(UUID reservationId) { return Optional.empty(); }
		@Override public void release(UUID reservationId) { }
		@Override public long getStock(String productId) { return remainingStock; }
		@Override public boolean hasActiveReservation(String productId, String buyerId) { return active.contains(productId + ":" + buyerId); }
	}
}
