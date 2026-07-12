package com.vnshop.inventoryservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.vnshop.inventoryservice.domain.StockReservation;
import com.vnshop.inventoryservice.domain.port.out.InventoryEventPublisherPort;
import com.vnshop.inventoryservice.domain.port.out.StockReservationPort;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ReleaseStockUseCaseTest {

    private final Clock fixedClock = Clock.fixed(Instant.parse("2026-05-17T10:00:00Z"), ZoneOffset.UTC);

    @Test
    void releaseSuccessBatchReleasesAllReservations() {
        // Given
        InMemoryStockReservationPort realPort = new InMemoryStockReservationPort();
        StockReservationPort port = mock(StockReservationPort.class);
        when(port.tryDecrement(any(), anyInt())).thenAnswer(inv -> realPort.tryDecrement(inv.getArgument(0), inv.getArgument(1)));
        when(port.findActiveReservationsByOrderId(any())).thenAnswer(inv -> realPort.findActiveReservationsByOrderId(inv.getArgument(0)));
        doAnswer(inv -> { realPort.incrementBatch(inv.getArgument(0)); return null; }).when(port).incrementBatch(any());
        doAnswer(inv -> { realPort.batchMarkReleased(inv.getArgument(0), inv.getArgument(1)); return null; }).when(port).batchMarkReleased(any(), any());
        doAnswer(inv -> { realPort.markReleased(inv.getArgument(0)); return null; }).when(port).markReleased(any());

        InventoryEventPublisherPort eventPublisher = mock(InventoryEventPublisherPort.class);
        ReleaseStockUseCase useCase = new ReleaseStockUseCase(port, fixedClock, eventPublisher);

        UUID res1 = UUID.randomUUID();
        UUID res2 = UUID.randomUUID();
        Instant now = fixedClock.instant();

        // Seed two reservations for the same order
        realPort.addReservation(new StockReservation(
                res1, "order-1", "prod-A", "default", 3,
                StockReservation.Status.RESERVED, now, null));
        realPort.addReservation(new StockReservation(
                res2, "order-1", "prod-B", "default", 5,
                StockReservation.Status.RESERVED, now, null));

        // When
        boolean result = useCase.release("order-1");

        // Then
        assertThat(result).isTrue();
        // Verify batch increment was called with accumulated quantities
        verify(port).incrementBatch(Map.of("prod-A", 3, "prod-B", 5));
        // Verify batch mark released was called
        verify(port).batchMarkReleased(any(), eq(now));
        // Verify event published
        verify(eventPublisher).publishReleased(eq("order-1"), any(), any());
    }

    @Test
    void releaseMultipleReservationsForSameProductAccumulatesQuantity() {
        // Given
        InMemoryStockReservationPort realPort = new InMemoryStockReservationPort();
        StockReservationPort port = mock(StockReservationPort.class);
        when(port.tryDecrement(any(), anyInt())).thenAnswer(inv -> realPort.tryDecrement(inv.getArgument(0), inv.getArgument(1)));
        when(port.findActiveReservationsByOrderId(any())).thenAnswer(inv -> realPort.findActiveReservationsByOrderId(inv.getArgument(0)));
        doAnswer(inv -> { realPort.incrementBatch(inv.getArgument(0)); return null; }).when(port).incrementBatch(any());
        doAnswer(inv -> { realPort.batchMarkReleased(inv.getArgument(0), inv.getArgument(1)); return null; }).when(port).batchMarkReleased(any(), any());
        doAnswer(inv -> { realPort.markReleased(inv.getArgument(0)); return null; }).when(port).markReleased(any());

        InventoryEventPublisherPort eventPublisher = mock(InventoryEventPublisherPort.class);
        ReleaseStockUseCase useCase = new ReleaseStockUseCase(port, fixedClock, eventPublisher);

        UUID res1 = UUID.randomUUID();
        UUID res2 = UUID.randomUUID();
        Instant now = fixedClock.instant();

        // Two reservations for the same product
        realPort.addReservation(new StockReservation(
                res1, "order-2", "prod-A", "default", 2,
                StockReservation.Status.RESERVED, now, null));
        realPort.addReservation(new StockReservation(
                res2, "order-2", "prod-A", "variant-1", 3,
                StockReservation.Status.RESERVED, now, null));

        // When
        useCase.release("order-2");

        // Then - quantities should be accumulated
        verify(port).incrementBatch(Map.of("prod-A", 5));
        verify(port).batchMarkReleased(any(), eq(now));
    }

    @Test
    void releaseNoActiveReservationsIsNoOp() {
        // Given
        InMemoryStockReservationPort realPort = new InMemoryStockReservationPort();
        StockReservationPort port = mock(StockReservationPort.class);
        when(port.tryDecrement(any(), anyInt())).thenAnswer(inv -> realPort.tryDecrement(inv.getArgument(0), inv.getArgument(1)));
        when(port.findActiveReservationsByOrderId(any())).thenAnswer(inv -> realPort.findActiveReservationsByOrderId(inv.getArgument(0)));
        doAnswer(inv -> { realPort.incrementBatch(inv.getArgument(0)); return null; }).when(port).incrementBatch(any());
        doAnswer(inv -> { realPort.batchMarkReleased(inv.getArgument(0), inv.getArgument(1)); return null; }).when(port).batchMarkReleased(any(), any());
        doAnswer(inv -> { realPort.markReleased(inv.getArgument(0)); return null; }).when(port).markReleased(any());

        InventoryEventPublisherPort eventPublisher = mock(InventoryEventPublisherPort.class);
        ReleaseStockUseCase useCase = new ReleaseStockUseCase(port, fixedClock, eventPublisher);

        // When
        boolean result = useCase.release("order-without-reservations");

        // Then
        assertThat(result).isTrue();
        // Only findActiveReservationsByOrderId should be called (returns empty list)
        verify(port).findActiveReservationsByOrderId("order-without-reservations");
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void releaseNullOrderIdThrows() {
        // Given
        InMemoryStockReservationPort port = new InMemoryStockReservationPort();
        InventoryEventPublisherPort eventPublisher = mock(InventoryEventPublisherPort.class);
        ReleaseStockUseCase useCase = new ReleaseStockUseCase(port, fixedClock, eventPublisher);

        // When/Then
        assertThatThrownBy(() -> useCase.release(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("orderId must not be blank");
    }

    @Test
    void releaseBlankOrderIdThrows() {
        // Given
        InMemoryStockReservationPort port = new InMemoryStockReservationPort();
        InventoryEventPublisherPort eventPublisher = mock(InventoryEventPublisherPort.class);
        ReleaseStockUseCase useCase = new ReleaseStockUseCase(port, fixedClock, eventPublisher);

        // When/Then
        assertThatThrownBy(() -> useCase.release("   "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("orderId must not be blank");
    }

    /**
     * In-memory implementation of StockReservationPort for testing.
     * Tracks method calls to verify batch behavior.
     */
    static class InMemoryStockReservationPort implements StockReservationPort {
        private final java.util.HashMap<String, Integer> stockLevels = new java.util.HashMap<>();
        private final java.util.ArrayList<StockReservation> reservations = new java.util.ArrayList<>();

        @Override
        public DecrementOutcome tryDecrement(String productId, int quantity) {
            return DecrementOutcome.NOT_PROJECTED;
        }

        @Override
        public void increment(String productId, int quantity) {
            stockLevels.merge(productId, quantity, Integer::sum);
        }

        @Override
        public void incrementBatch(Map<String, Integer> productQuantities) {
            productQuantities.forEach((productId, qty) ->
                    stockLevels.merge(productId, qty, Integer::sum));
        }

        @Override
        public void saveReservation(StockReservation reservation) {
            reservations.add(reservation);
        }

        @Override
        public List<StockReservation> findActiveReservationsByOrderId(String orderId) {
            return reservations.stream()
                    .filter(r -> r.orderId().equals(orderId)
                            && r.status() == StockReservation.Status.RESERVED)
                    .toList();
        }

        @Override
        public void markReleased(StockReservation reservation) {
            // no-op for batch test
        }

        @Override
        public void batchMarkReleased(List<UUID> reservationIds, Instant releasedAt) {
            for (int i = 0; i < reservations.size(); i++) {
                StockReservation r = reservations.get(i);
                if (reservationIds.contains(r.reservationId())) {
                    reservations.set(i, r.released(releasedAt));
                }
            }
        }

        void addReservation(StockReservation reservation) {
            reservations.add(reservation);
        }

        int stockOf(String productId) {
            return stockLevels.getOrDefault(productId, 0);
        }
    }
}
