package com.vnshop.inventoryservice.application;

import com.vnshop.inventoryservice.domain.StockReservation;
import com.vnshop.inventoryservice.domain.port.out.StockReservationPort;
import com.vnshop.inventoryservice.infrastructure.event.InventoryEventPublisher;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;

/**
 * Releases all stock previously reserved for an order. Idempotent: repeated
 * Release calls for the same order_id are no-ops once the reservations have
 * been moved to RELEASED.
 */
public class ReleaseStockUseCase {
    private static final Logger log = LoggerFactory.getLogger(ReleaseStockUseCase.class);

    private final StockReservationPort port;
    private final Clock clock;
    private final InventoryEventPublisher eventPublisher;

    public ReleaseStockUseCase(StockReservationPort port, InventoryEventPublisher eventPublisher) {
        this(port, Clock.systemUTC(), eventPublisher);
    }

    ReleaseStockUseCase(StockReservationPort port, Clock clock, InventoryEventPublisher eventPublisher) {
        this.port = port;
        this.clock = clock;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public boolean release(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("orderId must not be blank");
        }

        List<StockReservation> active = port.findActiveReservationsByOrderId(orderId);
        if (active.isEmpty()) {
            log.info("Release no-op: no active reservations for orderId={}", orderId);
            return true;
        }

        Instant now = clock.instant();
        List<InventoryEventPublisher.ReleasedItem> releasedItems = active.stream()
                .map(r -> new InventoryEventPublisher.ReleasedItem(r.productId(), r.quantity()))
                .toList();

        // Batch release: accumulate quantities by productId and release all in one operation
        Map<String, Integer> quantitiesToRelease = active.stream()
                .collect(Collectors.groupingBy(
                        StockReservation::productId,
                        Collectors.summingInt(StockReservation::quantity)));
        port.incrementBatch(quantitiesToRelease);
        port.batchMarkReleased(
                active.stream().map(StockReservation::reservationId).toList(),
                now);
        log.info("Released {} reservations for orderId={}", active.size(), orderId);

        eventPublisher.publishReleased(orderId, null, releasedItems);
        return true;
    }
}
