package com.vnshop.shippingservice.infrastructure.grpc;

import com.vnshop.proto.shipping.ShippingRequest;
import com.vnshop.proto.shipping.ShippingResponse;
import com.vnshop.proto.shipping.ShippingServiceGrpc;
import com.vnshop.shippingservice.application.CreateLabelUseCase;
import com.vnshop.shippingservice.domain.CarrierCode;
import com.vnshop.shippingservice.domain.ShippingAddress;
import com.vnshop.shippingservice.domain.model.LabelRequest;
import com.vnshop.shippingservice.domain.model.RateQuote;
import com.vnshop.shippingservice.domain.model.RateQuoteRequest;
import com.vnshop.shippingservice.domain.model.ShippingLabel;
import com.vnshop.shippingservice.domain.model.TrackingInfo;
import com.vnshop.shippingservice.domain.model.TrackingRequest;
import com.vnshop.shippingservice.domain.port.out.CarrierGatewayPort;
import com.vnshop.shippingservice.infrastructure.config.ShippingCheckoutProperties;
import com.vnshop.shippingservice.infrastructure.config.CarrierProperties;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.StatusRuntimeException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.StandardEnvironment;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GrpcShippingServerTest {
    private Server server;
    private ManagedChannel channel;
    private ShippingServiceGrpc.ShippingServiceBlockingStub stub;
    private CapturingGateway gateway;

    @BeforeEach
    void setUp() throws IOException {
        gateway = new CapturingGateway();
        StandardEnvironment environment = new StandardEnvironment();
        environment.setActiveProfiles("local");
        GrpcShippingServer service = new GrpcShippingServer(
                new CreateLabelUseCase(gateway, new CarrierProperties("stub"), environment),
                new ShippingCheckoutProperties(CarrierCode.GHTK,
                        new ShippingAddress("Seller", "0900000000", "1 Origin", "W1", "D1", "HCM")));
        server = ServerBuilder.forPort(0).addService(service).build().start();
        channel = ManagedChannelBuilder.forAddress("localhost", server.getPort()).usePlaintext().build();
        stub = ShippingServiceGrpc.newBlockingStub(channel);
    }

    @AfterEach
    void tearDown() {
        channel.shutdown();
        server.shutdown();
    }

    @Test
    void requestShippingCreatesCarrierLabelFromGrpcFields() {
        ShippingResponse response = stub.requestShipping(validRequest());

        assertTrue(response.getSuccess());
        assertEquals(1, response.getLabelsCount());
        assertEquals("TRACK-ord-1001", response.getLabels(0).getTrackingCode());
        assertEquals("GHTK", response.getLabels(0).getCarrier());
        assertTrue(response.getLabels(0).getEstimatedDelivery().isBlank());

        LabelRequest sent = gateway.lastRequest;
        assertEquals(com.vnshop.shippingservice.domain.model.CarrierCode.GHTK, sent.carrier());
        assertEquals("ord-1001", sent.orderId());
        assertEquals("Nguyen Van A", sent.toAddress().name());
        assertEquals("0901234567", sent.toAddress().phone());
        assertEquals("123 Le Loi", sent.toAddress().street());
        assertEquals("Ho Chi Minh", sent.toAddress().district());
        assertEquals("Ho Chi Minh", sent.toAddress().province());
        assertEquals("prod-1:red x2", sent.itemDescription());
        assertEquals(null, sent.parcel());
    }

    @Test
    void requestShippingPropagatesCarrierFailure() {
        gateway.failure = new IllegalStateException("carrier unavailable");

        StatusRuntimeException exception = assertThrows(StatusRuntimeException.class,
                () -> stub.requestShipping(validRequest()));

        assertEquals(io.grpc.Status.Code.FAILED_PRECONDITION, exception.getStatus().getCode());
        assertTrue(exception.getStatus().getDescription().contains("carrier unavailable"));
    }

    @Test
    void requestShippingFailsWithEmptySubOrders() {
        StatusRuntimeException exception = assertThrows(StatusRuntimeException.class, () -> stub.requestShipping(
                ShippingRequest.newBuilder().setOrderId("ord-1002").build()));

        assertEquals(io.grpc.Status.Code.INVALID_ARGUMENT, exception.getStatus().getCode());
    }

    @Test
    void requestShippingFailsWithBlankOrderId() {
        StatusRuntimeException exception = assertThrows(StatusRuntimeException.class, () -> stub.requestShipping(
                validRequest().toBuilder().setOrderId("").build()));

        assertEquals(io.grpc.Status.Code.INVALID_ARGUMENT, exception.getStatus().getCode());
    }

    private static ShippingRequest validRequest() {
        return ShippingRequest.newBuilder()
                .setOrderId("ord-1001")
                .addSubOrders(com.vnshop.proto.shipping.SubOrder.newBuilder()
                        .setSellerId("seller-1")
                        .addItems(com.vnshop.proto.shipping.SubOrderItem.newBuilder()
                                .setProductId("prod-1").setVariant("red").setQuantity(2).build())
                        .setShippingAddress(com.vnshop.proto.shipping.ShippingAddress.newBuilder()
                                .setFullName("Nguyen Van A").setPhone("0901234567")
                                .setStreet("123 Le Loi").setCity("Ho Chi Minh").setProvince("Ho Chi Minh")
                                .build())
                        .build())
                .build();
    }

    private static final class CapturingGateway implements CarrierGatewayPort {
        private LabelRequest lastRequest;
        private RuntimeException failure;

        @Override public RateQuote quote(RateQuoteRequest request) { throw new UnsupportedOperationException(); }
        @Override public TrackingInfo track(TrackingRequest request) { throw new UnsupportedOperationException(); }

        @Override
        public ShippingLabel createLabel(LabelRequest request) {
            lastRequest = request;
            if (failure != null) {
                throw failure;
            }
            return new ShippingLabel(request.carrier(), request.orderId(), "TRACK-" + request.orderId(), null, 30_000L);
        }
    }
}
