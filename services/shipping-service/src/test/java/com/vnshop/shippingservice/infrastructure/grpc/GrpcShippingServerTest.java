package com.vnshop.shippingservice.infrastructure.grpc;

import com.vnshop.proto.v1.ShippingRequest;
import com.vnshop.proto.v1.ShippingResponse;
import com.vnshop.proto.v1.ShippingServiceGrpc;
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
import com.vnshop.shippingservice.domain.port.out.CarrierLabelPolicyPort;
import com.vnshop.shippingservice.infrastructure.config.ShippingCheckoutProperties;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.StatusRuntimeException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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
        CarrierLabelPolicyPort policy = () -> true;
        GrpcShippingServer service = new GrpcShippingServer(
                new CreateLabelUseCase(gateway, policy),
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
        assertEquals("W1", sent.toAddress().ward());
        assertEquals("D1", sent.toAddress().district());
        assertEquals("P1", sent.toAddress().province());
        assertEquals("prod-1:red x2", sent.itemDescription());
        assertEquals(2500, sent.parcel().weightGrams());
        assertEquals(20, sent.parcel().lengthCm());
        assertEquals(15, sent.parcel().widthCm());
        assertEquals(10, sent.parcel().heightCm());
        assertEquals(120000L, sent.codAmountVnd());
    }

    @Test
    void requestShippingPropagatesCarrierFailure() {
        gateway.failure = new IllegalStateException("carrier unavailable");

        StatusRuntimeException exception = assertThrows(StatusRuntimeException.class,
                () -> stub.requestShipping(validRequest()));

        assertEquals(io.grpc.Status.Code.FAILED_PRECONDITION, exception.getStatus().getCode());
        assertEquals("Carrier label creation failed", exception.getStatus().getDescription());
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
                .addSubOrders(com.vnshop.proto.v1.SubOrder.newBuilder()
                        .setSellerId("seller-1")
                        .addItems(com.vnshop.proto.v1.SubOrderItem.newBuilder()
                                .setProductId("prod-1").setVariant("red").setQuantity(2).build())
                        .setShippingAddress(com.vnshop.proto.v1.ShippingAddress.newBuilder()
                        .setFullName("Nguyen Van A").setPhone("0901234567")
                                .setStreet("123 Le Loi").setCity("Ho Chi Minh").setProvince("Ho Chi Minh")
                                .setWardCode("W1").setDistrictCode("D1").setProvinceCode("P1")
                                .build())
                        .setParcelWeightGrams(2500).setParcelLengthCm(20).setParcelWidthCm(15).setParcelHeightCm(10)
                        .setCodAmount(com.vnshop.proto.v1.Money.newBuilder().setAmount("120000").setCurrency("VND"))
                        .setDeclaredValue(com.vnshop.proto.v1.Money.newBuilder().setAmount("120000").setCurrency("VND"))
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
