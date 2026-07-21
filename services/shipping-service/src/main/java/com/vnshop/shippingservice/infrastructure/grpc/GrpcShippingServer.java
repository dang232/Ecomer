package com.vnshop.shippingservice.infrastructure.grpc;

import com.vnshop.proto.shipping.ShippingRequest;
import com.vnshop.proto.shipping.ShippingResponse;
import com.vnshop.proto.shipping.ShippingServiceGrpc;
import com.vnshop.shippingservice.domain.model.CarrierCode;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.stub.StreamObserver;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.LocalDate;
import java.util.UUID;

@Component
@ConditionalOnProperty(name = "grpc.server.enabled", havingValue = "true", matchIfMissing = true)
public class GrpcShippingServer extends ShippingServiceGrpc.ShippingServiceImplBase {

    private static final Logger log = LoggerFactory.getLogger(GrpcShippingServer.class);

    private Server server;

    @Value("${grpc.server.port:9095}")
    int port;

    @PostConstruct
    public void start() throws IOException {
        server = ServerBuilder.forPort(port)
                .addService(this)
                .build()
                .start();
        log.info("Shipping gRPC server started on port {}", port);
    }

    @PreDestroy
    public void stop() {
        if (server != null) {
            server.shutdown();
            log.info("Shipping gRPC server stopped");
        }
    }

    @Override
    public void requestShipping(ShippingRequest request,
                                StreamObserver<ShippingResponse> responseObserver) {
        if (request.getOrderId().isBlank()) {
            responseObserver.onError(
                    new IllegalArgumentException("orderId must not be blank"));
            return;
        }
        if (request.getSubOrdersCount() == 0) {
            responseObserver.onError(
                    new IllegalArgumentException("subOrders must not be empty"));
            return;
        }

        log.info("Requesting shipping for order {} with {} sub-order(s)",
                request.getOrderId(), request.getSubOrdersCount());

        // TODO: delegate to CreateLabelCommand / carrier gateway for real labels
        var response = ShippingResponse.newBuilder()
                .setSuccess(true);

        for (int i = 0; i < request.getSubOrdersCount(); i++) {
            var subOrder = request.getSubOrders(i);
            String trackingCode = "VN" + UUID.randomUUID().toString()
                    .replace("-", "").substring(0, 12).toUpperCase();
            CarrierCode carrier = pickCarrier(i);
            String estimatedDelivery = LocalDate.now().plusDays(3 + i).toString();

            response.addLabels(com.vnshop.proto.shipping.ShippingLabel.newBuilder()
                    .setTrackingCode(trackingCode)
                    .setCarrier(carrier.name())
                    .setEstimatedDelivery(estimatedDelivery)
                    .build());
        }

        responseObserver.onNext(response.build());
        responseObserver.onCompleted();
    }

    private CarrierCode pickCarrier(int index) {
        CarrierCode[] values = CarrierCode.values();
        return values[index % values.length];
    }
}
