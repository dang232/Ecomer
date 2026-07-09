package com.vnshop.inventoryservice.infrastructure.grpc;

import com.vnshop.inventoryservice.application.ReleaseStockUseCase;
import com.vnshop.inventoryservice.application.ReserveStockUseCase;
import com.vnshop.inventoryservice.application.ReserveStockUseCase.ReserveStockResult;
import com.vnshop.inventoryservice.domain.StockReservation;
import com.vnshop.inventoryservice.domain.port.out.StockReservationPort;
import com.vnshop.inventoryservice.domain.port.out.StockReservationPort.DecrementOutcome;
import com.vnshop.inventoryservice.infrastructure.event.InventoryEventPublisher;
import com.vnshop.proto.inventory.*;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.StatusRuntimeException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class GrpcInventoryServerTest {
    private Server server;
    private ManagedChannel channel;
    private InventoryServiceGrpc.InventoryServiceBlockingStub stub;
    private InMemoryStockReservationPort port;

    @BeforeEach
    void setUp() throws IOException {
        port = new InMemoryStockReservationPort();
        ReserveStockUseCase reserveUseCase = new ReserveStockUseCase(port);
        ReleaseStockUseCase releaseUseCase = new ReleaseStockUseCase(port, mock(InventoryEventPublisher.class));
        GrpcInventoryServer service = new GrpcInventoryServer(reserveUseCase, releaseUseCase);
        service.port = 0; // random port
        server = ServerBuilder.forPort(0).addService(service).build().start();
        channel = ManagedChannelBuilder.forAddress("localhost", server.getPort())
            .usePlaintext().build();
        stub = InventoryServiceGrpc.newBlockingStub(channel);
    }

    @AfterEach
    void tearDown() {
        channel.shutdown();
        server.shutdown();
    }

    @Test
    void reserveAllowsOrderWhenStockIsNotProjectedYet() {
        // No row in stock_levels for "p1" — pragmatic compromise: allow with warn
        ReserveResponse response = stub.reserve(ReserveRequest.newBuilder()
            .setOrderId("ord-1")
            .addItems(OrderItem.newBuilder().setProductId("p1").setQuantity(1).build())
            .build());

        assertTrue(response.getSuccess());
        assertEquals(1, response.getReservedItems());
    }

    @Test
    void reserveDecrementsProjectedStockAndPersistsReservation() {
        port.seed("p1", 5);

        ReserveResponse response = stub.reserve(ReserveRequest.newBuilder()
            .setOrderId("ord-2")
            .addItems(OrderItem.newBuilder().setProductId("p1").setQuantity(2).build())
            .build());

        assertTrue(response.getSuccess());
        assertEquals(1, response.getReservedItems());
        assertEquals(3, port.stockOf("p1"));
        assertEquals(1, port.findActiveReservationsByOrderId("ord-2").size());
    }

    @Test
    void reserveFailsWhenInsufficientStockAndDoesNotPersist() {
        port.seed("p1", 1);

        ReserveResponse response = stub.reserve(ReserveRequest.newBuilder()
            .setOrderId("ord-3")
            .addItems(OrderItem.newBuilder().setProductId("p1").setQuantity(5).build())
            .build());

        assertFalse(response.getSuccess());
        assertEquals(0, response.getReservedItems());
        assertEquals(1, port.stockOf("p1"));
        assertTrue(port.findActiveReservationsByOrderId("ord-3").isEmpty());
    }

    @Test
    void reserveFailsWithEmptyItems() {
        assertThrows(StatusRuntimeException.class, () -> stub.reserve(ReserveRequest.newBuilder()
            .setOrderId("ord-1").build()));
    }

    @Test
    void releaseRefundsActiveReservations() {
        port.seed("p1", 5);
        stub.reserve(ReserveRequest.newBuilder()
            .setOrderId("ord-4")
            .addItems(OrderItem.newBuilder().setProductId("p1").setQuantity(2).build())
            .build());
        assertEquals(3, port.stockOf("p1"));

        ReleaseResponse response = stub.release(ReleaseRequest.newBuilder()
            .setOrderId("ord-4").build());

        assertTrue(response.getSuccess());
        assertEquals(5, port.stockOf("p1"));
        assertTrue(port.findActiveReservationsByOrderId("ord-4").isEmpty());
    }

    @Test
    void releaseIsIdempotentWhenNoActiveReservations() {
        ReleaseResponse response = stub.release(ReleaseRequest.newBuilder()
            .setOrderId("nonexistent").build());

        assertTrue(response.getSuccess());
    }

    /**
     * In-memory port that mirrors the contract of the JPA repository for the
     * gRPC integration test. Decrement is conditional on existing stock,
     * matching the conditional UPDATE in the production query.
     */
    static final class InMemoryStockReservationPort implements StockReservationPort {
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
        public synchronized void batchMarkReleased(List<UUID> reservationIds, Instant releasedAt) {
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
