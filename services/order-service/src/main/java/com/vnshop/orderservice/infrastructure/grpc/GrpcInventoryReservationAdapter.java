package com.vnshop.orderservice.infrastructure.grpc;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.OrderItem;
import com.vnshop.orderservice.domain.port.out.InventoryReservationPort;
import com.vnshop.proto.v1.InventoryServiceGrpc;
import com.vnshop.proto.v1.ReleaseRequest;
import com.vnshop.proto.v1.ReleaseResponse;
import com.vnshop.proto.v1.ReserveRequest;
import com.vnshop.proto.v1.ReserveResponse;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;

@Component
@ConditionalOnBean(InventoryServiceGrpc.InventoryServiceBlockingStub.class)
public class GrpcInventoryReservationAdapter implements InventoryReservationPort {

    private static final Logger LOGGER = LoggerFactory.getLogger(GrpcInventoryReservationAdapter.class);
    private static final String TOPIC_RELEASE_REQUESTED = "inventory.release-requested";

    private final InventoryServiceGrpc.InventoryServiceBlockingStub inventoryStub;
    private final CircuitBreaker circuitBreaker;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public GrpcInventoryReservationAdapter(
            InventoryServiceGrpc.InventoryServiceBlockingStub inventoryStub,
            CircuitBreaker inventoryCircuitBreaker,
            KafkaTemplate<String, String> kafkaTemplate,
            ObjectMapper objectMapper) {
        this.inventoryStub = Objects.requireNonNull(inventoryStub, "inventoryStub is required");
        this.circuitBreaker = Objects.requireNonNull(inventoryCircuitBreaker, "inventoryCircuitBreaker is required");
        this.kafkaTemplate = Objects.requireNonNull(kafkaTemplate, "kafkaTemplate is required");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is required");
    }

    @Override
    public void reserve(String orderId, List<OrderItem> items) {
        Objects.requireNonNull(orderId, "orderId is required");
        Objects.requireNonNull(items, "items is required");
        if (items.isEmpty()) {
            throw new IllegalArgumentException("items must not be empty");
        }

        List<com.vnshop.proto.v1.OrderItem> protoItems = items.stream()
                .map(item -> com.vnshop.proto.v1.OrderItem.newBuilder()
                        .setProductId(item.productId())
                        .setVariant(item.variantSku())
                        .setQuantity(item.quantity())
                        .build())
                .toList();

        ReserveRequest request = ReserveRequest.newBuilder()
                .setOrderId(orderId)
                .setOperationId(orderId)
                .addAllItems(protoItems)
                .build();

        LOGGER.info("Sending reserve request for order {} with {} items", orderId, protoItems.size());
        try {
            ReserveResponse response = circuitBreaker.executeSupplier(() ->
                    inventoryStub
                            .withDeadlineAfter(2500, TimeUnit.MILLISECONDS)
                            .reserve(request));
            if (!response.getSuccess()) {
                throw new RuntimeException("Inventory reservation failed for order " + orderId);
            }
            LOGGER.info("Inventory reserved for order {}: {} items", orderId, response.getReservedItems());
        } catch (CallNotPermittedException e) {
            LOGGER.error("Circuit breaker OPEN for inventory-service: {}", e.getMessage());
            throw new RuntimeException("Inventory service unavailable (circuit open)", e);
        } catch (StatusRuntimeException e) {
            LOGGER.error("gRPC reserve call failed for order {}: {}", orderId, e.getMessage(), e);
            throw new RuntimeException("Inventory reservation failed for order " + orderId, e);
        }
    }

    @Override
    public void release(String orderId) {
        Objects.requireNonNull(orderId, "orderId is required");

        ReleaseRequest request = ReleaseRequest.newBuilder()
                .setOrderId(orderId)
                .build();

        LOGGER.info("Sending release request for order {}", orderId);
        try {
            ReleaseResponse response = circuitBreaker.executeSupplier(() ->
                    inventoryStub
                            .withDeadlineAfter(2500, TimeUnit.MILLISECONDS)
                            .release(request));
            if (!response.getSuccess()) {
                throw new RuntimeException("Inventory release failed for order " + orderId);
            }
            LOGGER.info("Inventory released for order {}", orderId);
        } catch (CallNotPermittedException e) {
            LOGGER.warn("Circuit breaker OPEN for inventory-service — publishing release to Kafka fallback for order {}", orderId);
            publishReleaseRequested(orderId);
        } catch (StatusRuntimeException e) {
            LOGGER.error("gRPC release call failed for order {}: {}", orderId, e.getMessage(), e);
            throw new RuntimeException("Inventory release failed for order " + orderId, e);
        }
    }

    private void publishReleaseRequested(String orderId) {
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                "orderId", orderId,
                "operationId", "inventory-release:" + orderId,
                "timestamp", Instant.now().toString()
            ));
            kafkaTemplate.send(TOPIC_RELEASE_REQUESTED, orderId, payload).get(5, TimeUnit.SECONDS);
            LOGGER.info("Kafka acknowledged inventory.release-requested for order {}", orderId);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize release-requested event for order " + orderId, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while publishing release-requested event for order " + orderId, e);
        } catch (ExecutionException | TimeoutException e) {
            throw new IllegalStateException("Inventory release fallback was not acknowledged for order " + orderId, e);
        }
    }
}
