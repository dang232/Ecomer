package com.vnshop.paymentservice.infrastructure.grpc;

import com.vnshop.paymentservice.application.GetPaymentStatusUseCase;
import com.vnshop.paymentservice.application.PaymentMethodInput;
import com.vnshop.paymentservice.application.ProcessPaymentCommand;
import com.vnshop.paymentservice.application.ProcessPaymentUseCase;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.proto.payment.*;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.stub.StreamObserver;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;

@Component
public class GrpcPaymentServer extends PaymentServiceGrpc.PaymentServiceImplBase {

    private static final Logger log = LoggerFactory.getLogger(GrpcPaymentServer.class);

    private final ProcessPaymentUseCase processPaymentUseCase;
    private final GetPaymentStatusUseCase getPaymentStatusUseCase;

    private Server server;

    @Value("${grpc.server.port:9094}")
    int port;

    public GrpcPaymentServer(ProcessPaymentUseCase processPaymentUseCase,
                             GetPaymentStatusUseCase getPaymentStatusUseCase) {
        this.processPaymentUseCase = processPaymentUseCase;
        this.getPaymentStatusUseCase = getPaymentStatusUseCase;
    }

    @PostConstruct
    public void start() throws IOException {
        server = ServerBuilder.forPort(port)
                .addService(this)
                .build()
                .start();
        log.info("Payment gRPC server started on port {}", port);
    }

    @PreDestroy
    public void stop() {
        if (server != null) {
            server.shutdown();
        }
    }

    @Override
    public void requestPayment(PaymentRequest request,
                               StreamObserver<PaymentResponse> responseObserver) {
        try {
            if (request.getOrderId().isBlank() || request.getBuyerId().isBlank()) {
                responseObserver.onError(
                        new IllegalArgumentException("orderId and buyerId are required"));
                return;
            }

            BigDecimal amount = new BigDecimal(request.getAmount().getAmount());
            if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                responseObserver.onError(
                        new IllegalArgumentException("amount must be positive"));
                return;
            }

            PaymentMethodInput method =
                    PaymentMethodInput.valueOf(request.getPaymentMethod().toUpperCase());

            ProcessPaymentCommand cmd = new ProcessPaymentCommand(
                    request.getOrderId(), request.getBuyerId(), method);

            // Trusted service-to-service path: order-service initiates this
            // call from CreateOrderUseCase BEFORE the order row is persisted,
            // so the HTTP-side OrderCatalogPort lookup would 404. The amount
            // comes from order-service's own domain model so it's already
            // authoritative — bypass the catalog lookup via processInternal.
            // The HTTP /payment/*/create endpoints continue to use the
            // lookup-based process(cmd) entry point.
            Payment payment = processPaymentUseCase.processInternal(cmd, amount);

            if (payment.status() == com.vnshop.paymentservice.domain.PaymentStatus.FAILED) {
                throw new IllegalStateException("payment request failed");
            }

            responseObserver.onNext(PaymentResponse.newBuilder()
                    .setPaymentId(payment.paymentId().toString())
                    .setStatus(payment.status().name())
                    .build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("requestPayment failed", e);
            responseObserver.onError(e);
        }
    }

    @Override
    public void getPaymentStatus(PaymentStatusRequest request,
                                 StreamObserver<PaymentStatusResponse> responseObserver) {
        try {
            Payment payment = getPaymentStatusUseCase.getByOrderId(request.getOrderId());

            responseObserver.onNext(PaymentStatusResponse.newBuilder()
                    .setPaymentId(payment.paymentId().toString())
                    .setStatus(payment.status().name())
                    .build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            log.error("getPaymentStatus failed", e);
            responseObserver.onError(e);
        }
    }
}
