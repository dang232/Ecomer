package com.vnshop.inventoryservice.application;

import com.vnshop.inventoryservice.domain.StockReservation;
import com.vnshop.inventoryservice.domain.port.out.StockReservationPort;
import com.vnshop.inventoryservice.domain.port.out.StockReservationPort.DecrementOutcome;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("orderId must not be blank");
        }
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("items must not be empty");
        }

        Instant now = clock.instant();
        List<StockReservation> created = new ArrayList<>(items.size());

        for (ReserveItem item : items) {
            DecrementOutcome outcome = port.tryDecrement(item.productId(), item.quantity());
            if (outcome == DecrementOutcome.INSUFFICIENT || outcome == DecrementOutcome.NOT_PROJECTED) {
                log.warn("Reserve denied: {} stock orderId={} productId={} qty={}",
                        outcome == DecrementOutcome.NOT_PROJECTED ? "missing projected" : "insufficient",
                        orderId, item.productId(), item.quantity());
                return ReserveStockResult.insufficient();
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

        return ReserveStockResult.success(created.size());
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

    public record ReserveStockResult(boolean success, int reservedItems) {
        public static ReserveStockResult success(int count) {
            return new ReserveStockResult(true, count);
        }

        public static ReserveStockResult insufficient() {
            return new ReserveStockResult(false, 0);
        }
    }
}
