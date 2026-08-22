package com.vnshop.inventoryservice.infrastructure.grpc;

import com.vnshop.inventoryservice.application.ReleaseStockUseCase;
import com.vnshop.inventoryservice.application.ReserveStockUseCase;
import com.vnshop.inventoryservice.application.ReserveStockUseCase.ReserveItem;
import com.vnshop.inventoryservice.application.ReserveStockUseCase.ReserveStockResult;
import com.vnshop.proto.inventory.*;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.ServerInterceptors;
import io.grpc.stub.StreamObserver;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.util.List;
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

    public GrpcInventoryServer(ReserveStockUseCase reserveStockUseCase,
                                ReleaseStockUseCase releaseStockUseCase) {
        this.reserveStockUseCase = reserveStockUseCase;
        this.releaseStockUseCase = releaseStockUseCase;
    }

    @PostConstruct
    public void start() throws IOException {
        server = ServerBuilder.forPort(port)
            .addService(ServerInterceptors.intercept(this, new GrpcTracePropagationInterceptor()))
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
            ReserveStockResult result = reserveStockUseCase.reserve(request.getOrderId(), items);
            log.info("Reserve orderId={} items={} success={} reservedItems={}",
                    request.getOrderId(), items.size(), result.success(), result.reservedItems());
            responseObserver.onNext(ReserveResponse.newBuilder()
                    .setSuccess(result.success())
                    .setReservedItems(result.reservedItems())
                    .build());
            responseObserver.onCompleted();
        } catch (IllegalArgumentException e) {
            responseObserver.onError(e);
        } catch (Exception e) {
            log.error("Reserve failed orderId={}", request.getOrderId(), e);
            responseObserver.onError(e);
        }
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
