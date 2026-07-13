package com.vnshop.paymentservice.infrastructure.grpc;

import com.vnshop.paymentservice.application.GetPaymentStatusUseCase;
import com.vnshop.paymentservice.application.ProcessPaymentCommand;
import com.vnshop.paymentservice.application.ProcessPaymentUseCase;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.proto.common.Money;
import com.vnshop.proto.payment.*;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.eq;

class GrpcPaymentServerTest {

    private final ProcessPaymentUseCase processPaymentUseCase = mock(ProcessPaymentUseCase.class);
    private final GetPaymentStatusUseCase getPaymentStatusUseCase = mock(GetPaymentStatusUseCase.class);
    private Server server;
    private ManagedChannel channel;
    private PaymentServiceGrpc.PaymentServiceBlockingStub stub;

    @BeforeEach
    void setUp() throws IOException {
        GrpcPaymentServer service = new GrpcPaymentServer(
                processPaymentUseCase, getPaymentStatusUseCase);
        service.port = 0;
        server = ServerBuilder.forPort(0)
                .addService(service)
                .build()
                .start();
        channel = ManagedChannelBuilder.forAddress("localhost", server.getPort())
                .usePlaintext()
                .build();
        stub = PaymentServiceGrpc.newBlockingStub(channel);
    }

    @AfterEach
    void tearDown() {
        if (channel != null) {
            channel.shutdown();
        }
        if (server != null) {
            server.shutdown();
        }
    }

    @Test
    void requestPaymentDelegatesToUseCase() {
        Payment mockPayment = mock(Payment.class);
        UUID mockId = UUID.randomUUID();
        when(mockPayment.paymentId()).thenReturn(mockId);
        when(mockPayment.status()).thenReturn(PaymentStatus.PENDING);
        when(processPaymentUseCase.processInternal(any(), any())).thenReturn(mockPayment);

        PaymentResponse response = stub.requestPayment(PaymentRequest.newBuilder()
                .setOrderId("ord-1")
                .setBuyerId("buyer-1")
                .setAmount(Money.newBuilder()
                        .setAmount("100000")
                        .setCurrency("VND")
                        .build())
                .setPaymentMethod("COD")
                .build());

        assertEquals(mockId.toString(), response.getPaymentId());
        assertEquals("PENDING", response.getStatus());

        // Pt12: gRPC is the trusted service-to-service path. The use case's
        // processInternal entry point takes the trusted amount directly,
        // bypassing the OrderCatalogPort lookup that the HTTP path uses.
        verify(processPaymentUseCase).processInternal(argThat(cmd ->
                cmd.orderId().equals("ord-1")
                        && cmd.buyerId().equals("buyer-1")
                        && cmd.method().name().equals("COD")), eq(new BigDecimal("100000")));
    }

    @Test
    void requestPaymentFailsWithMissingOrderId() {
        assertThrows(Exception.class, () ->
                stub.requestPayment(PaymentRequest.newBuilder()
                        .setOrderId("")
                        .setBuyerId("buyer-1")
                        .setAmount(Money.newBuilder()
                                .setAmount("100000")
                                .setCurrency("VND")
                                .build())
                        .setPaymentMethod("COD")
                .build()));
    }

    @Test
    void requestPaymentFailsWhenGatewayReturnsFailedPayment() {
        Payment failedPayment = mock(Payment.class);
        when(failedPayment.status()).thenReturn(PaymentStatus.FAILED);
        when(processPaymentUseCase.processInternal(any(), any())).thenReturn(failedPayment);

        assertThrows(Exception.class, () -> stub.requestPayment(PaymentRequest.newBuilder()
                .setOrderId("ord-1")
                .setBuyerId("buyer-1")
                .setAmount(Money.newBuilder().setAmount("100000").setCurrency("VND").build())
                .setPaymentMethod("VNPAY")
                .build()));
    }

    @Test
    void requestPaymentFailsWithNegativeAmount() {
        // The gRPC server still validates amount > 0 before calling the use
        // case, since this is the trusted service-to-service path. The HTTP
        // path doesn't accept amount at all (resolved from OrderCatalogPort).
        assertThrows(Exception.class, () ->
                stub.requestPayment(PaymentRequest.newBuilder()
                        .setOrderId("ord-1")
                        .setBuyerId("buyer-1")
                        .setAmount(Money.newBuilder()
                                .setAmount("-1")
                                .setCurrency("VND")
                                .build())
                        .setPaymentMethod("COD")
                        .build()));
    }

    @Test
    void requestPaymentFailsWithZeroAmount() {
        assertThrows(Exception.class, () ->
                stub.requestPayment(PaymentRequest.newBuilder()
                        .setOrderId("ord-1")
                        .setBuyerId("buyer-1")
                        .setAmount(Money.newBuilder()
                                .setAmount("0")
                                .setCurrency("VND")
                                .build())
                        .setPaymentMethod("COD")
                        .build()));
    }

    @Test
    void getPaymentStatusDelegatesToUseCase() {
        Payment mockPayment = mock(Payment.class);
        UUID mockId = UUID.randomUUID();
        when(mockPayment.paymentId()).thenReturn(mockId);
        when(mockPayment.status()).thenReturn(PaymentStatus.COMPLETED);
        when(getPaymentStatusUseCase.getByOrderId("ord-2")).thenReturn(mockPayment);

        PaymentStatusResponse response = stub.getPaymentStatus(
                PaymentStatusRequest.newBuilder()
                        .setOrderId("ord-2")
                        .build());

        assertEquals(mockId.toString(), response.getPaymentId());
        assertEquals("COMPLETED", response.getStatus());
        verify(getPaymentStatusUseCase).getByOrderId("ord-2");
    }
}
