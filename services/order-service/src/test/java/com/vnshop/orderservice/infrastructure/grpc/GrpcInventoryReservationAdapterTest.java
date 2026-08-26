package com.vnshop.orderservice.infrastructure.grpc;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.proto.v1.InventoryServiceGrpc;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

class GrpcInventoryReservationAdapterTest {

    private InventoryServiceGrpc.InventoryServiceBlockingStub inventoryStub;
    private KafkaTemplate<String, String> kafkaTemplate;
    private GrpcInventoryReservationAdapter adapter;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        inventoryStub = mock(InventoryServiceGrpc.InventoryServiceBlockingStub.class);
        kafkaTemplate = mock(KafkaTemplate.class);
        CircuitBreaker circuitBreaker = CircuitBreaker.ofDefaults("inventory-release-test");
        circuitBreaker.transitionToForcedOpenState();
        adapter = new GrpcInventoryReservationAdapter(inventoryStub, circuitBreaker, kafkaTemplate, new ObjectMapper());
    }

    @Test
    void releaseFallbackSucceedsOnlyAfterKafkaAcknowledges() {
        when(kafkaTemplate.send(eq("inventory.release-requested"), eq("order-1"), anyString()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        assertDoesNotThrow(() -> adapter.release("order-1"));

        verify(kafkaTemplate).send(eq("inventory.release-requested"), eq("order-1"), anyString());
    }

    @Test
    void releaseFallbackFailsWhenKafkaDoesNotAcknowledge() {
        when(kafkaTemplate.send(eq("inventory.release-requested"), eq("order-1"), anyString()))
                .thenReturn(CompletableFuture.failedFuture(new IllegalStateException("broker unavailable")));

        assertThrows(IllegalStateException.class, () -> adapter.release("order-1"));
    }
}
