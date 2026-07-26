package com.vnshop.inventoryservice.infrastructure.flash;

import com.vnshop.inventoryservice.domain.FlashSaleReservation;
import com.vnshop.inventoryservice.domain.DuplicateFlashSaleReservationException;
import com.vnshop.inventoryservice.application.FlashSaleIdempotencyConflictException;
import com.vnshop.inventoryservice.application.FlashSaleDependencyUnavailableException;
import com.vnshop.inventoryservice.domain.port.out.FlashSaleReservationPort;
import com.vnshop.inventoryservice.infrastructure.persistence.FlashSaleReservationOutboxJpaEntity;
import com.vnshop.inventoryservice.infrastructure.persistence.FlashSaleReservationOutboxJpaRepository;
import java.time.Duration;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class RedisLuaFlashSaleGateway implements FlashSaleReservationPort {
	private static final Logger LOGGER = LoggerFactory.getLogger(RedisLuaFlashSaleGateway.class);
	private static final Duration RESERVATION_TTL = Duration.ofMinutes(15);
	private static final Duration IDEMPOTENCY_TTL = Duration.ofMinutes(20);
	private static final String KEY_PREFIX = "vnshop:flash-sale:v1:";
	private static final String IDEMPOTENCY_PREFIX = "vnshop:idempotency:v1:flash-sale:";
	private static final String EXPIRATION_INDEX = KEY_PREFIX + "reservation:expires";

	private final StringRedisTemplate redisTemplate;
	private final RedisScript<Long> flashReserveScript;
	private final RedisScript<Long> flashReleaseScript;
	private final WaitingRoomService waitingRoomService;
	private final FlashSaleReservationOutboxJpaRepository outboxRepository;

	public RedisLuaFlashSaleGateway(StringRedisTemplate redisTemplate, RedisScript<Long> flashReserveScript,
			RedisScript<Long> flashReleaseScript, WaitingRoomService waitingRoomService,
			FlashSaleReservationOutboxJpaRepository outboxRepository) {
		this.redisTemplate = redisTemplate;
		this.flashReserveScript = flashReserveScript;
		this.flashReleaseScript = flashReleaseScript;
		this.waitingRoomService = waitingRoomService;
		this.outboxRepository = outboxRepository;
	}

	@Override
	public boolean reserve(String productId, String buyerId, int quantity, UUID reservationId) {
		String legacyKey = "legacy-" + reservationId;
		String requestHash = digest(productId + "\n" + quantity);
		return reserveIdempotently(productId, buyerId, quantity, legacyKey, requestHash)
				.reservation().getStatus() == FlashSaleReservation.Status.RESERVED;
	}

	@Override
	public IdempotentReservation reserveIdempotently(
			String productId, String buyerId, int quantity, String idempotencyKey, String requestHash) {
		if (idempotencyKey == null || idempotencyKey.isBlank() || requestHash == null || requestHash.isBlank()) {
			throw new IllegalArgumentException("idempotency key and request hash are required");
		}
		UUID reservationId = UUID.randomUUID();
		Instant reservedAt = Instant.now();
		Instant expiresAt = reservedAt.plus(RESERVATION_TTL);
		String idempotencyRedisKey = idempotencyKey(productId, buyerId, idempotencyKey);
		String idempotencyHash = idempotencyHash(productId, buyerId, idempotencyKey);
		FlashSaleReservationOutboxJpaEntity outbox = outboxRepository.findByIdempotencyKeyHash(idempotencyHash)
				.orElseGet(() -> createPending(idempotencyHash, requestHash, productId, buyerId, quantity,
						reservationId, reservedAt, expiresAt));
		if (!requestHash.equals(outbox.getRequestHash())) {
			throw new FlashSaleIdempotencyConflictException(idempotencyKey);
		}
		if (outbox.getState() != FlashSaleReservationOutboxJpaEntity.State.PENDING) {
			return new IdempotentReservation(outbox.toDomain(), true);
		}
		return executePendingReservation(outbox, idempotencyRedisKey);
	}

	private FlashSaleReservationOutboxJpaEntity createPending(String idempotencyHash, String requestHash,
			String productId, String buyerId, int quantity, UUID reservationId,
			Instant reservedAt, Instant expiresAt) {
		try {
			return outboxRepository.saveAndFlush(new FlashSaleReservationOutboxJpaEntity(
					reservationId, idempotencyHash, requestHash, productId, buyerId, quantity,
					FlashSaleReservationOutboxJpaEntity.State.PENDING, reservedAt, expiresAt));
		} catch (DataIntegrityViolationException exception) {
			return outboxRepository.findByIdempotencyKeyHash(idempotencyHash).orElseThrow(() -> exception);
		}
	}

	private IdempotentReservation executePendingReservation(
			FlashSaleReservationOutboxJpaEntity outbox, String idempotencyRedisKey) {
		UUID reservationId = outbox.getReservationId();
		Instant reservedAt = outbox.getReservedAt();
		Instant expiresAt = outbox.getExpiresAt();
		Long result;
		try {
			result = redisTemplate.execute(
					flashReserveScript,
					List.of(stockKey(outbox.getProductId()), waitingSetKey(outbox.getProductId()), idempotencyRedisKey,
							reservationKey(reservationId), EXPIRATION_INDEX),
					Integer.toString(outbox.getQuantity()), outbox.getBuyerId(), reservationId.toString(), outbox.getRequestHash(),
					reservedAt.toString(), expiresAt.toString(),
					Long.toString(RESERVATION_TTL.toSeconds()), Long.toString(IDEMPOTENCY_TTL.toSeconds()),
					Long.toString(expiresAt.toEpochMilli()));
		} catch (RuntimeException exception) {
			throw new FlashSaleDependencyUnavailableException(exception);
		}

		if (Long.valueOf(2).equals(result)) {
			String storedHash = hashValue(idempotencyRedisKey, "requestHash");
			if (!outbox.getRequestHash().equals(storedHash)) {
				throw new FlashSaleIdempotencyConflictException(outbox.getIdempotencyKeyHash());
			}
			String storedReservationId = hashValue(idempotencyRedisKey, "reservationId");
			if (storedReservationId == null) {
				throw new IllegalStateException("idempotency record has no reservation");
			}
			FlashSaleReservation replay = findById(UUID.fromString(storedReservationId))
					.orElseGet(outbox::toDomain);
			outbox.setState(FlashSaleReservationOutboxJpaEntity.State.ACCEPTED);
			outboxRepository.save(outbox);
			return new IdempotentReservation(replay, true);
		}
			if (Long.valueOf(3).equals(result)) {
				throw new DuplicateFlashSaleReservationException(outbox.getProductId(), outbox.getBuyerId());
		}
		if (Long.valueOf(0).equals(result)) {
			outbox.setState(FlashSaleReservationOutboxJpaEntity.State.REJECTED);
			outboxRepository.save(outbox);
			return new IdempotentReservation(new FlashSaleReservation(
					null, outbox.getProductId(), outbox.getBuyerId(), outbox.getQuantity(), FlashSaleReservation.Status.REJECTED,
					reservedAt, expiresAt), false);
		}
		if (!Long.valueOf(1).equals(result)) {
			throw new IllegalStateException("flash-sale reservation script returned no result");
		}
		FlashSaleReservation reservation = findById(reservationId)
				.orElseThrow(() -> new IllegalStateException("atomic reservation was not persisted in Redis"));
		try {
			outbox.setState(FlashSaleReservationOutboxJpaEntity.State.ACCEPTED);
			outboxRepository.saveAndFlush(outbox);
		} catch (RuntimeException exception) {
			release(reservationId);
			throw exception;
		}
		waitingRoomService.join(outbox.getProductId(), outbox.getBuyerId());
		return new IdempotentReservation(reservation, false);
	}

	@Override
	public void save(FlashSaleReservation reservation) {
		String reservationId = reservation.getReservationId().toString();
		String key = reservationKey(reservation.getReservationId());
		redisTemplate.opsForHash().put(key, "reservationId", reservationId);
		redisTemplate.opsForHash().put(key, "productId", reservation.getProductId());
		redisTemplate.opsForHash().put(key, "buyerId", reservation.getBuyerId());
		redisTemplate.opsForHash().put(key, "quantity", Integer.toString(reservation.getQuantity()));
		redisTemplate.opsForHash().put(key, "status", reservation.getStatus().name());
		redisTemplate.opsForHash().put(key, "reservedAt", reservation.getReservedAt().toString());
		redisTemplate.opsForHash().put(key, "expiresAt", reservation.getExpiresAt().toString());
		redisTemplate.expire(key, IDEMPOTENCY_TTL);
		redisTemplate.opsForZSet().add(EXPIRATION_INDEX, reservationId, reservation.getExpiresAt().toEpochMilli());
	}

	@Override
	public Optional<FlashSaleReservation> findById(UUID reservationId) {
		String key = reservationKey(reservationId);
		if (Boolean.FALSE.equals(redisTemplate.hasKey(key))) {
			return Optional.empty();
		}
		String productId = hashValue(key, "productId");
		String buyerId = hashValue(key, "buyerId");
		String quantity = hashValue(key, "quantity");
		String status = hashValue(key, "status");
		String reservedAt = hashValue(key, "reservedAt");
		String expiresAt = hashValue(key, "expiresAt");
		if (productId == null || buyerId == null || quantity == null || status == null || reservedAt == null || expiresAt == null) {
			return Optional.empty();
		}
		return Optional.of(new FlashSaleReservation(
				reservationId,
				productId,
				buyerId,
				Integer.parseInt(quantity),
				FlashSaleReservation.Status.valueOf(status),
				Instant.parse(reservedAt),
				Instant.parse(expiresAt)));
	}

	@Override
	public void release(UUID reservationId) {
		findById(reservationId).ifPresent(reservation -> {
			String reservationIdValue = reservationId.toString();
			redisTemplate.execute(
					flashReleaseScript,
					List.of(stockKey(reservation.getProductId()), reservationKey(reservationId),
							waitingSetKey(reservation.getProductId()), EXPIRATION_INDEX),
						Integer.toString(reservation.getQuantity()), reservation.getBuyerId());
				redisTemplate.opsForZSet().remove(EXPIRATION_INDEX, reservationIdValue);
				waitingRoomService.leave(reservation.getProductId(), reservation.getBuyerId());
				outboxRepository.findById(reservationId).ifPresent(outbox -> {
					outbox.setState(FlashSaleReservationOutboxJpaEntity.State.RELEASED);
					outboxRepository.save(outbox);
				});
			});
	}

	@Override
	public long getStock(String productId) {
		String stock = redisTemplate.opsForValue().get(stockKey(productId));
		return stock == null ? 0 : Long.parseLong(stock);
	}

	@Override
	public boolean hasActiveReservation(String productId, String buyerId) {
		return Boolean.TRUE.equals(redisTemplate.opsForSet().isMember(waitingSetKey(productId), buyerId));
	}

	@Scheduled(fixedDelayString = "PT1M")
	public void releaseExpiredReservations() {
		var dueReservations = redisTemplate.opsForZSet().rangeByScore(EXPIRATION_INDEX, 0, Instant.now().toEpochMilli());
		if (dueReservations == null || dueReservations.isEmpty()) {
			return;
		}
		dueReservations.stream()
				.map(UUID::fromString)
				.forEach(this::release);
	}

	/** Retries database-backed pending intents after a Redis or database interruption. */
	@Scheduled(fixedDelayString = "PT30S")
	public void reconcilePendingReservations() {
		outboxRepository.findByState(FlashSaleReservationOutboxJpaEntity.State.PENDING)
				.forEach(outbox -> {
					try {
						executePendingReservation(outbox, IDEMPOTENCY_PREFIX + outbox.getIdempotencyKeyHash());
					} catch (RuntimeException exception) {
						LOGGER.warn("flash-sale reservation reconciliation failed reservationId={}: {}",
								outbox.getReservationId(), exception.getMessage());
					}
				});
	}

	private String hashValue(String key, String field) {
		Object value = redisTemplate.opsForHash().get(key, field);
		return value == null ? null : value.toString();
	}

	private String stockKey(String productId) {
		return KEY_PREFIX + "stock:" + productId;
	}

	private String waitingSetKey(String productId) {
		return KEY_PREFIX + "waiting:" + productId;
	}

	private String reservationKey(UUID reservationId) {
		return KEY_PREFIX + "reservation:" + reservationId;
	}

	private String idempotencyKey(String productId, String buyerId, String idempotencyKey) {
		return IDEMPOTENCY_PREFIX + idempotencyHash(productId, buyerId, idempotencyKey);
	}

	private String idempotencyHash(String productId, String buyerId, String idempotencyKey) {
		return digest(productId + ":" + buyerId + ":" + idempotencyKey);
	}

	private static String digest(String value) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
					.digest(value.getBytes(StandardCharsets.UTF_8)));
		} catch (Exception exception) {
			throw new IllegalStateException("SHA-256 is unavailable", exception);
		}
	}
}
