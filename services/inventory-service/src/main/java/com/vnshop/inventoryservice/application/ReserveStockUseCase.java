package com.vnshop.inventoryservice.application;

import com.vnshop.inventoryservice.domain.StockReservation;
import com.vnshop.inventoryservice.domain.port.out.StockReservationPort;
import com.vnshop.inventoryservice.domain.port.out.StockReservationPort.DecrementOutcome;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reserves projected stock for an order. Each line item runs through a single
 * conditional UPDATE that the database evaluates atomically; if any item is
 * insufficient, every prior decrement performed in the same call is rolled
 * back by the surrounding {@link Transactional} boundary.
 *
 * <p>A product must have a projected {@code stock_levels} row before it can
 * be reserved. Local and test environments must seed stock explicitly.
 */
public class ReserveStockUseCase {
    private static final Logger log = LoggerFactory.getLogger(ReserveStockUseCase.class);

    private final StockReservationPort port;
    private final Clock clock;

    public ReserveStockUseCase(StockReservationPort port) {
        this(port, Clock.systemUTC());
    }

    ReserveStockUseCase(StockReservationPort port, Clock clock) {
        this.port = port;
        this.clock = clock;
    }

    @Transactional
    public ReserveStockResult reserve(String orderId, List<ReserveItem> items) {
        return reserve(null, orderId, items);
    }

    @Transactional
    public ReserveStockResult reserve(String operationId, String orderId, List<ReserveItem> items) {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("orderId must not be blank");
        }
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("items must not be empty");
        }

        String normalizedOperationId = normalize(operationId);
        String requestHash = normalizedOperationId == null ? null : requestHash(orderId, items);
        if (normalizedOperationId != null) {
            Optional<ReservationOperation> existing = port.findOperation(normalizedOperationId);
            if (existing.isPresent()) {
                ReservationOperation operation = existing.get();
                if (!operation.requestHash().equals(requestHash)) {
                    throw new ReservationOperationConflictException(normalizedOperationId);
                }
                return ReserveStockResult.fromOperation(operation, true);
            }
        }

        Instant now = clock.instant();
        List<StockReservation> created = new ArrayList<>(items.size());

        for (ReserveItem item : items) {
            DecrementOutcome outcome = port.tryDecrement(item.productId(), item.quantity());
            if (outcome == DecrementOutcome.INSUFFICIENT || outcome == DecrementOutcome.NOT_PROJECTED) {
                log.warn("Reserve denied: {} stock orderId={} productId={} qty={}",
                        outcome == DecrementOutcome.NOT_PROJECTED ? "missing projected" : "insufficient",
                        orderId, item.productId(), item.quantity());
                ReserveStockResult result = outcome == DecrementOutcome.NOT_PROJECTED
                        ? ReserveStockResult.notProjected(now)
                        : ReserveStockResult.insufficient(now);
                saveOperation(normalizedOperationId, requestHash, result);
                return result;
            }

            StockReservation reservation = new StockReservation(
                    UUID.randomUUID(),
                    orderId,
                    item.productId(),
                    item.variant(),
                    item.quantity(),
                    StockReservation.Status.RESERVED,
                    now,
                    null);
            port.saveReservation(reservation);
            created.add(reservation);
        }

        ReserveStockResult result = ReserveStockResult.success(created.size(), now);
        saveOperation(normalizedOperationId, requestHash, result);
        return result;
    }

    public record ReserveItem(String productId, String variant, int quantity) {
        public ReserveItem {
            if (productId == null || productId.isBlank()) {
                throw new IllegalArgumentException("productId must not be blank");
            }
            if (quantity <= 0) {
                throw new IllegalArgumentException("quantity must be positive");
            }
        }
    }

    public record ReserveStockResult(boolean success, int reservedItems, boolean replayed,
                                     ReservationOperation.ReservationStatus status,
                                     ReservationOperation.ReservationFailureCode failureCode,
                                     Instant processedAt) {
        public static ReserveStockResult success(int count, Instant processedAt) {
            return new ReserveStockResult(true, count, false,
                    ReservationOperation.ReservationStatus.RESERVED,
                    ReservationOperation.ReservationFailureCode.NONE, processedAt);
        }

        public static ReserveStockResult insufficient(Instant processedAt) {
            return new ReserveStockResult(false, 0, false,
                    ReservationOperation.ReservationStatus.REJECTED,
                    ReservationOperation.ReservationFailureCode.INSUFFICIENT_STOCK, processedAt);
        }


        public static ReserveStockResult notProjected(Instant processedAt) {
            return new ReserveStockResult(false, 0, false,
                    ReservationOperation.ReservationStatus.REJECTED,
                    ReservationOperation.ReservationFailureCode.NOT_PROJECTED, processedAt);
        }

        public static ReserveStockResult conflict(Instant processedAt) {
            return new ReserveStockResult(false, 0, false,
                    ReservationOperation.ReservationStatus.CONFLICT,
                    ReservationOperation.ReservationFailureCode.OPERATION_CONFLICT, processedAt);
        }

        static ReserveStockResult fromOperation(ReservationOperation operation, boolean replayed) {
            return new ReserveStockResult(operation.success(), operation.reservedItems(), replayed,
                    operation.status(), operation.failureCode(), operation.processedAt());
        }
    }

    private void saveOperation(String operationId, String requestHash, ReserveStockResult result) {
        if (operationId != null) {
            port.saveOperation(new ReservationOperation(operationId, requestHash, result.success(),
                    result.reservedItems(), result.status(), result.failureCode(), result.processedAt()));
        }
    }

    private static String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String requestHash(String orderId, List<ReserveItem> items) {
        String canonical = orderId + "|" + items.stream()
                .map(item -> item.productId() + ":" + String.valueOf(item.variant()) + ":" + item.quantity())
                .reduce((left, right) -> left + ";" + right).orElseThrow();
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 not available", exception);
        }
    }
}
