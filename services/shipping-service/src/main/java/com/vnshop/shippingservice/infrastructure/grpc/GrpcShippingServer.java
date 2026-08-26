package com.vnshop.shippingservice.infrastructure.grpc;

import com.vnshop.proto.v1.ShippingRequest;
import com.vnshop.proto.v1.ShippingResponse;
import com.vnshop.proto.v1.ShippingServiceGrpc;
import com.vnshop.shippingservice.application.CreateLabelCommand;
import com.vnshop.shippingservice.application.CreateLabelResult;
import com.vnshop.shippingservice.application.CreateLabelUseCase;
import com.vnshop.shippingservice.domain.ShippingAddress;
import com.vnshop.shippingservice.domain.ShippingLineItem;
import com.vnshop.shippingservice.domain.Money;
import com.vnshop.shippingservice.domain.Parcel;
import com.vnshop.shippingservice.infrastructure.config.ShippingCheckoutProperties;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.netty.shaded.io.grpc.netty.GrpcSslContexts;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;
import io.grpc.ServerInterceptors;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.File;
import java.util.List;
import java.util.Objects;

@Component
@ConditionalOnProperty(name = "grpc.server.enabled", havingValue = "true", matchIfMissing = true)
public class GrpcShippingServer extends ShippingServiceGrpc.ShippingServiceImplBase {

    private static final Logger log = LoggerFactory.getLogger(GrpcShippingServer.class);

    private final CreateLabelUseCase createLabelUseCase;
    private final ShippingCheckoutProperties checkoutProperties;
    private Server server;

    @Value("${grpc.server.port:9095}")
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

    public GrpcShippingServer(
            CreateLabelUseCase createLabelUseCase,
            ShippingCheckoutProperties checkoutProperties) {
        this.createLabelUseCase = Objects.requireNonNull(createLabelUseCase, "createLabelUseCase is required");
        this.checkoutProperties = Objects.requireNonNull(checkoutProperties, "checkoutProperties is required");
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
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("orderId must not be blank").asRuntimeException());
            return;
        }
        if (request.getSubOrdersCount() == 0) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("subOrders must not be empty").asRuntimeException());
            return;
        }

        log.info("Requesting shipping for order {} with {} sub-order(s)",
                request.getOrderId(), request.getSubOrdersCount());

        var response = ShippingResponse.newBuilder()
                .setSuccess(true);

        try {
            for (var subOrder : request.getSubOrdersList()) {
                CreateLabelResult label = createLabelUseCase.create(toCreateLabelCommand(request.getOrderId(), subOrder));
                response.addLabels(com.vnshop.proto.v1.ShippingLabel.newBuilder()
                        .setTrackingCode(label.trackingCode())
                        .setCarrier(label.carrierCode().name())
                        .build());
            }
        } catch (IllegalArgumentException exception) {
            log.warn("Invalid shipping label request orderId={} exceptionType={}",
                    request.getOrderId(), exception.getClass().getSimpleName());
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid shipping label request")
                    .asRuntimeException());
            return;
        } catch (RuntimeException exception) {
            log.error("Carrier label creation failed for order {} exceptionType={}",
                    request.getOrderId(), exception.getClass().getSimpleName());
            responseObserver.onError(Status.FAILED_PRECONDITION
                    .withDescription("Carrier label creation failed")
                    .asRuntimeException());
            return;
        }

        responseObserver.onNext(response.build());
        responseObserver.onCompleted();
    }

    private CreateLabelCommand toCreateLabelCommand(String orderId, com.vnshop.proto.v1.SubOrder subOrder) {
        var destination = subOrder.getShippingAddress();
        List<ShippingLineItem> items = subOrder.getItemsList().stream()
                .map(item -> new ShippingLineItem(
                        item.getProductId() + (item.getVariant().isBlank() ? "" : ":" + item.getVariant()),
                        item.getQuantity(),
                        item.hasDeclaredValue() ? new java.math.BigDecimal(item.getDeclaredValue().getAmount())
                                : null))
                .toList();

        var declaredValue = toMoney(subOrder.getDeclaredValue());
        var codAmount = toMoney(subOrder.getCodAmount());
        var parcelSnapshot = subOrder.hasParcel() ? subOrder.getParcel() : null;
        var parcel = parcelSnapshot != null && parcelSnapshot.getWeightGrams() > 0
                ? new Parcel(parcelSnapshot.getWeightGrams(), parcelSnapshot.getLengthCm(),
                parcelSnapshot.getWidthCm(), parcelSnapshot.getHeightCm(), parcelSnapshot.getDeclaredValueMinor())
                : subOrder.getParcelWeightGrams() > 0
                ? new Parcel(subOrder.getParcelWeightGrams(), subOrder.getParcelLengthCm(),
                subOrder.getParcelWidthCm(), subOrder.getParcelHeightCm(), 0L)
                : null;

        return new CreateLabelCommand(
                checkoutProperties.defaultCarrier(),
                orderId,
                checkoutProperties.origin(),
                new ShippingAddress(destination.getFullName(), destination.getPhone(), destination.getStreet(),
                        destination.getWardCode(),
                        destination.getDistrictCode(),
                        destination.getProvinceCode()),
                parcel,
                codAmount,
                declaredValue,
                items);
    }

    private static Money toMoney(com.vnshop.proto.v1.Money money) {
        return money == null || money.getAmount().isBlank() ? null
                : new Money(new java.math.BigDecimal(money.getAmount()), money.getCurrency());
    }

}
