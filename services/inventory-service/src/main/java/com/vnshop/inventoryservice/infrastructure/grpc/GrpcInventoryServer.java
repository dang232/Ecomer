package com.vnshop.inventoryservice.infrastructure.grpc;

import com.vnshop.inventoryservice.application.ReleaseStockUseCase;
import com.vnshop.inventoryservice.application.ReserveStockUseCase;
import com.vnshop.inventoryservice.application.ReserveStockUseCase.ReserveItem;
import com.vnshop.inventoryservice.application.ReserveStockUseCase.ReserveStockResult;
import com.vnshop.proto.v1.*;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.netty.shaded.io.grpc.netty.GrpcSslContexts;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;
import io.grpc.ServerInterceptors;
import io.grpc.stub.StreamObserver;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.io.File;
import java.util.List;
import com.google.protobuf.Timestamp;
import com.vnshop.inventoryservice.application.ReservationOperationConflictException;
import com.vnshop.inventoryservice.domain.ReservationOperation;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * gRPC entry point for the order saga's Reserve/Release calls. The previous
 * stubs always returned {@code success=true}, which let the saga oversell.
 * This implementation delegates to {@link ReserveStockUseCase} and
 * {@link ReleaseStockUseCase}, which run inside a database transaction and
 * decrement stock atomically via a conditional UPDATE.
 */
@Component
public class GrpcInventoryServer extends InventoryServiceGrpc.InventoryServiceImplBase {
    private static final Logger log = LoggerFactory.getLogger(GrpcInventoryServer.class);

    private final ReserveStockUseCase reserveStockUseCase;
    private final ReleaseStockUseCase releaseStockUseCase;
    private Server server;

    @Value("${grpc.server.port:9093}")
    int port;

    @Value("${grpc.server.auth.service-id:order-service}")
    String expectedServiceId;

    @Value("${grpc.server.auth.token:}")
    String expectedServiceToken;

    @Value("${grpc.server.tls.cert-chain:}")
    String tlsCertChain;
    @Value("${grpc.server.tls.private-key:}")
    String tlsPrivateKey;
    @Value("${grpc.server.tls.client-ca:}")
    String tlsClientCa;

    public GrpcInventoryServer(ReserveStockUseCase reserveStockUseCase,
                                ReleaseStockUseCase releaseStockUseCase) {
        this.reserveStockUseCase = reserveStockUseCase;
        this.releaseStockUseCase = releaseStockUseCase;
    }

    @PostConstruct
    public void start() throws IOException {
        if (tlsCertChain.isBlank() || tlsPrivateKey.isBlank() || tlsClientCa.isBlank()) {
            throw new IllegalStateException("gRPC mTLS certificate configuration is required");
        }
        server = NettyServerBuilder.forPort(port)
            .sslContext(GrpcSslContexts.forServer(new File(tlsCertChain), new File(tlsPrivateKey))
                    .trustManager(new File(tlsClientCa)).clientAuth(
                            io.grpc.netty.shaded.io.netty.handler.ssl.ClientAuth.REQUIRE).build())
            .addService(ServerInterceptors.intercept(this,
                    new GrpcServiceAuthInterceptor(expectedServiceId, expectedServiceToken),
                    new GrpcTracePropagationInterceptor()))
            .build()
            .start();
        log.info("Inventory gRPC server started on port {}", port);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            log.info("Shutting down Inventory gRPC server");
            GrpcInventoryServer.this.stop();
        }));
    }

    @PreDestroy
    public void stop() {
        if (server != null) {
            server.shutdown();
        }
    }

    @Override
    public void reserve(ReserveRequest request, StreamObserver<ReserveResponse> responseObserver) {
        if (request.getOrderId().isBlank()) {
            responseObserver.onError(new IllegalArgumentException("orderId must not be blank"));
            return;
        }
        if (request.getItemsCount() == 0) {
            responseObserver.onError(new IllegalArgumentException("items must not be empty"));
            return;
        }

        List<ReserveItem> items = request.getItemsList().stream()
                .map(item -> new ReserveItem(item.getProductId(), item.getVariant(), item.getQuantity()))
                .toList();

        try {
            ReserveStockResult result = reserveStockUseCase.reserve(request.getOperationId(), request.getOrderId(), items);
            log.info("Reserve orderId={} items={} success={} reservedItems={}",
                    request.getOrderId(), items.size(), result.success(), result.reservedItems());
            responseObserver.onNext(ReserveResponse.newBuilder()
                    .setSuccess(result.success())
                    .setReservedItems(result.reservedItems())
                    .setStatus(toProtoStatus(result.status()))
                    .setReplayed(result.replayed())
                    .setFailureCode(toProtoFailureCode(result.failureCode()))
                    .setProcessedAt(Timestamp.newBuilder().setSeconds(result.processedAt().getEpochSecond())
                            .setNanos(result.processedAt().getNano()).build())
                    .build());
            responseObserver.onCompleted();
        } catch (ReservationOperationConflictException e) {
            ReserveStockResult result = ReserveStockResult.conflict(Instant.now());
            responseObserver.onNext(ReserveResponse.newBuilder()
                    .setSuccess(false)
                    .setStatus(ReservationStatus.RESERVATION_STATUS_CONFLICT)
                    .setFailureCode(ReservationFailureCode.RESERVATION_FAILURE_CODE_OPERATION_CONFLICT)
                    .setProcessedAt(Timestamp.newBuilder().setSeconds(result.processedAt().getEpochSecond())
                            .setNanos(result.processedAt().getNano()).build())
                    .build());
            responseObserver.onCompleted();
        } catch (IllegalArgumentException e) {
            responseObserver.onError(e);
        } catch (Exception e) {
            log.error("Reserve failed orderId={}", request.getOrderId(), e);
            responseObserver.onError(e);
        }
    }

    private static ReservationStatus toProtoStatus(ReservationOperation.ReservationStatus status) {
        return switch (status) {
            case RESERVED -> ReservationStatus.RESERVATION_STATUS_RESERVED;
            case REJECTED -> ReservationStatus.RESERVATION_STATUS_REJECTED;
            case CONFLICT -> ReservationStatus.RESERVATION_STATUS_CONFLICT;
        };
    }

    private static ReservationFailureCode toProtoFailureCode(ReservationOperation.ReservationFailureCode code) {
        return switch (code) {
            case NONE -> ReservationFailureCode.RESERVATION_FAILURE_CODE_UNSPECIFIED;
            case INSUFFICIENT_STOCK -> ReservationFailureCode.RESERVATION_FAILURE_CODE_INSUFFICIENT_STOCK;
            case NOT_PROJECTED -> ReservationFailureCode.RESERVATION_FAILURE_CODE_NOT_PROJECTED;
            case OPERATION_CONFLICT -> ReservationFailureCode.RESERVATION_FAILURE_CODE_OPERATION_CONFLICT;
        };
    }

    @Override
    public void release(ReleaseRequest request, StreamObserver<ReleaseResponse> responseObserver) {
        if (request.getOrderId().isBlank()) {
            responseObserver.onError(new IllegalArgumentException("orderId must not be blank"));
            return;
        }

        try {
            boolean success = releaseStockUseCase.release(request.getOrderId());
            log.info("Release orderId={} success={}", request.getOrderId(), success);
            responseObserver.onNext(ReleaseResponse.newBuilder().setSuccess(success).build());
            responseObserver.onCompleted();
        } catch (IllegalArgumentException e) {
            responseObserver.onError(e);
        } catch (Exception e) {
            log.error("Release failed orderId={}", request.getOrderId(), e);
            responseObserver.onError(e);
        }
    }
}
