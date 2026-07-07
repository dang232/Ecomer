package com.vnshop.inventoryservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.vnshop.inventoryservice.application.ReserveStockUseCase.ReserveItem;
import com.vnshop.inventoryservice.application.ReserveStockUseCase.ReserveStockResult;
import com.vnshop.inventoryservice.domain.StockReservation;
import com.vnshop.inventoryservice.domain.port.out.StockReservationPort;
import com.vnshop.inventoryservice.infrastructure.event.InventoryEventPublisher;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class ReserveStockUseCaseTest {

    private final Clock fixedClock = Clock.fixed(Instant.parse("2026-05-17T10:00:00Z"), ZoneOffset.UTC);

    @Test
    void reserveSuccessDecrementsStockAndPersistsReservation() {
        InMemoryStockReservationPort port = new InMemoryStockReservationPort();
        port.seed("prod-1", 5);
        ReserveStockUseCase useCase = new ReserveStockUseCase(port, fixedClock);

        ReserveStockResult result = useCase.reserve("ord-1",
                List.of(new ReserveItem("prod-1", "default", 2)));

        assertThat(result.success()).isTrue();
        assertThat(result.reservedItems()).isEqualTo(1);
        assertThat(port.stockOf("prod-1")).isEqualTo(3);
        assertThat(port.findActiveReservationsByOrderId("ord-1")).hasSize(1);
    }

    @Test
    void reserveFailsWhenInsufficientStockAndDoesNotPersistAnyReservation() {
        InMemoryStockReservationPort port = new InMemoryStockReservationPort();
        port.seed("prod-1", 1);
        ReserveStockUseCase useCase = new ReserveStockUseCase(port, fixedClock);

        ReserveStockResult result = useCase.reserve("ord-2",
                List.of(new ReserveItem("prod-1", "default", 5)));

        assertThat(result.success()).isFalse();
        assertThat(result.reservedItems()).isEqualTo(0);
        assertThat(port.stockOf("prod-1")).isEqualTo(1);
        assertThat(port.findActiveReservationsByOrderId("ord-2")).isEmpty();
    }

    @Test
    void reserveAllowsWithWarnWhenProductHasNoStockRow() {
        InMemoryStockReservationPort port = new InMemoryStockReservationPort();
        ReserveStockUseCase useCase = new ReserveStockUseCase(port, fixedClock);

        ReserveStockResult result = useCase.reserve("ord-3",
                List.of(new ReserveItem("brand-new-product", null, 3)));

        assertThat(result.success()).isTrue();
        assertThat(result.reservedItems()).isEqualTo(1);
        // No row created — the use case does not project stock for unknown products.
        assertThat(port.stockOf("brand-new-product")).isEqualTo(-1);
        assertThat(port.findActiveReservationsByOrderId("ord-3")).hasSize(1);
    }

    @Test
    void reserveRejectsBlankOrderId() {
        InMemoryStockReservationPort port = new InMemoryStockReservationPort();
        ReserveStockUseCase useCase = new ReserveStockUseCase(port, fixedClock);

        assertThatExceptionThrown(() -> useCase.reserve(" ", List.of(new ReserveItem("p", "v", 1))));
    }

    @Test
    void reserveRejectsEmptyItems() {
        InMemoryStockReservationPort port = new InMemoryStockReservationPort();
        ReserveStockUseCase useCase = new ReserveStockUseCase(port, fixedClock);

        assertThatExceptionThrown(() -> useCase.reserve("ord-1", List.of()));
    }

    @Test
    void releaseIsIdempotentWhenNoReservations() {
        InMemoryStockReservationPort port = new InMemoryStockReservationPort();
        ReleaseStockUseCase useCase = new ReleaseStockUseCase(port, fixedClock, mock(InventoryEventPublisher.class));

        boolean ok = useCase.release("ord-unknown");

        assertThat(ok).isTrue();
    }

    @Test
    void releaseRefundsAllActiveReservationsForOrder() {
        InMemoryStockReservationPort port = new InMemoryStockReservationPort();
        port.seed("prod-1", 5);
        ReserveStockUseCase reserve = new ReserveStockUseCase(port, fixedClock);
        ReleaseStockUseCase release = new ReleaseStockUseCase(port, fixedClock, mock(InventoryEventPublisher.class));
        reserve.reserve("ord-4", List.of(new ReserveItem("prod-1", "default", 2)));

        boolean ok = release.release("ord-4");

        assertThat(ok).isTrue();
        assertThat(port.stockOf("prod-1")).isEqualTo(5);
        assertThat(port.findActiveReservationsByOrderId("ord-4")).isEmpty();
    }

    private static void assertThatExceptionThrown(Runnable r) {
        try {
            r.run();
        } catch (IllegalArgumentException expected) {
            return;
        }
        throw new AssertionError("Expected IllegalArgumentException");
    }

    /** In-memory port mirroring the JPA repository contract. */
    private static final class InMemoryStockReservationPort implements StockReservationPort {
        private final ConcurrentHashMap<String, AtomicInteger> levels = new ConcurrentHashMap<>();
        private final List<StockReservation> reservations = new ArrayList<>();

        void seed(String productId, int qty) {
            levels.put(productId, new AtomicInteger(qty));
        }

        int stockOf(String productId) {
            AtomicInteger level = levels.get(productId);
            return level == null ? -1 : level.get();
        }

        @Override
        public synchronized DecrementOutcome tryDecrement(String productId, int quantity) {
            AtomicInteger level = levels.get(productId);
            if (level == null) {
                return DecrementOutcome.NOT_PROJECTED;
            }
            int current = level.get();
            if (current < quantity) {
                return DecrementOutcome.INSUFFICIENT;
            }
            level.set(current - quantity);
            return DecrementOutcome.APPLIED;
        }

        @Override
        public synchronized void increment(String productId, int quantity) {
            levels.computeIfAbsent(productId, k -> new AtomicInteger(0)).addAndGet(quantity);
        }

        @Override
        public synchronized void saveReservation(StockReservation reservation) {
            reservations.add(reservation);
        }

        @Override
        public synchronized List<StockReservation> findActiveReservationsByOrderId(String orderId) {
            return reservations.stream()
                    .filter(r -> orderId.equals(r.orderId()))
                    .filter(r -> r.status() == StockReservation.Status.RESERVED)
                    .toList();
        }

        @Override
        public synchronized void markReleased(StockReservation reservation) {
            for (int i = 0; i < reservations.size(); i++) {
                if (reservations.get(i).reservationId().equals(reservation.reservationId())) {
                    reservations.set(i, reservation);
                    return;
                }
            }
        }

        @Override
        public synchronized void incrementBatch(java.util.Map<String, Integer> productQuantities) {
            productQuantities.forEach((productId, qty) ->
                levels.computeIfAbsent(productId, k -> new AtomicInteger(0)).addAndGet(qty));
        }

        @Override
        public synchronized void batchMarkReleased(List<UUID> reservationIds, java.time.Instant releasedAt) {
            for (UUID id : reservationIds) {
                for (int i = 0; i < reservations.size(); i++) {
                    if (reservations.get(i).reservationId().equals(id)) {
                        reservations.set(i, reservations.get(i).released(releasedAt));
                        break;
                    }
                }
            }
        }
    }
}
