package com.vnshop.paymentservice.infrastructure.grpc;

import com.vnshop.paymentservice.application.GetPaymentStatusUseCase;
import com.vnshop.paymentservice.application.IdempotencyKeyConflictException;
import com.vnshop.paymentservice.application.PaymentMethodInput;
import com.vnshop.paymentservice.application.ProcessPaymentCommand;
import com.vnshop.paymentservice.application.ProcessPaymentUseCase;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.proto.v1.*;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.netty.shaded.io.grpc.netty.GrpcSslContexts;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;
import io.grpc.ServerInterceptors;
import io.grpc.ServerServiceDefinition;
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
import java.math.BigDecimal;
import com.google.protobuf.Timestamp;
import com.vnshop.paymentservice.application.PaymentProcessingResult;

@Component
@ConditionalOnProperty(name = "grpc.server.enabled", havingValue = "true", matchIfMissing = true)
public class GrpcPaymentServer extends PaymentServiceGrpc.PaymentServiceImplBase {

    private static final Logger log = LoggerFactory.getLogger(GrpcPaymentServer.class);

    private final ProcessPaymentUseCase processPaymentUseCase;
    private final GetPaymentStatusUseCase getPaymentStatusUseCase;

    private Server server;

    @Value("${grpc.server.port:9094}")
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

    public GrpcPaymentServer(ProcessPaymentUseCase processPaymentUseCase,
                             GetPaymentStatusUseCase getPaymentStatusUseCase) {
        this.processPaymentUseCase = processPaymentUseCase;
        this.getPaymentStatusUseCase = getPaymentStatusUseCase;
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
                .addService(authenticatedService())
                .build()
                .start();
        log.info("Payment gRPC server started on port {}", port);
    }

    ServerServiceDefinition authenticatedService() {
        return ServerInterceptors.intercept(
                this,
                new GrpcServiceAuthInterceptor(expectedServiceId, expectedServiceToken),
                new GrpcTracePropagationInterceptor());
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
                responseObserver.onError(Status.INVALID_ARGUMENT
                        .withDescription("orderId and buyerId are required").asRuntimeException());
                return;
            }

            BigDecimal amount = new BigDecimal(request.getAmount().getAmount());
            if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                responseObserver.onError(Status.INVALID_ARGUMENT
                        .withDescription("amount must be positive").asRuntimeException());
                return;
            }
            if (!"VND".equalsIgnoreCase(request.getAmount().getCurrency())) {
                responseObserver.onError(Status.INVALID_ARGUMENT
                        .withDescription("currency must be VND").asRuntimeException());
                return;
            }
            if (request.getIdempotencyScope() != IdempotencyScope.IDEMPOTENCY_SCOPE_ORDER_PAYMENT) {
                responseObserver.onError(Status.INVALID_ARGUMENT
                        .withDescription("idempotency_scope must be ORDER_PAYMENT").asRuntimeException());
                return;
            }

            PaymentMethodInput method = toMethodInput(request);

            ProcessPaymentCommand cmd = new ProcessPaymentCommand(
                    request.getOrderId(), request.getBuyerId(), method, request.getIdempotencyKey(),
                    request.getAmount().getCurrency(),
                    request.getIdempotencyScope().name().substring("IDEMPOTENCY_SCOPE_".length()));

            // Trusted service-to-service path: order-service initiates this
            // call from CreateOrderUseCase BEFORE the order row is persisted,
            // so the HTTP-side OrderCatalogPort lookup would 404. The amount
            // comes from order-service's own domain model so it's already
            // authoritative — bypass the catalog lookup via processInternal.
            // The HTTP /payment/*/create endpoints continue to use the
            // lookup-based process(cmd) entry point.
            PaymentProcessingResult processing = processPaymentUseCase.processInternalResult(cmd, amount);
            Payment payment = processing.payment();

            responseObserver.onNext(PaymentResponse.newBuilder()
                    .setPaymentId(payment.paymentId().toString())
                    .setStatus(payment.status().name())
                    .setStatusCode(toProtoStatus(payment.status()))
                    .setReplayed(processing.replayed())
                    .setProcessedAt(toTimestamp(processing.processedAt()))
                    .setFailureCode(toFailureCode(payment))
                    .build());
            responseObserver.onCompleted();
        } catch (IdempotencyKeyConflictException e) {
            responseObserver.onNext(PaymentResponse.newBuilder()
                    .setStatus("FAILED")
                    .setStatusCode(PaymentStatus.PAYMENT_STATUS_FAILED)
                    .setFailureCode(PaymentFailureCode.PAYMENT_FAILURE_CODE_IDEMPOTENCY_CONFLICT)
                    .setProcessedAt(toTimestamp(java.time.Instant.now()))
                    .build());
            responseObserver.onCompleted();
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid payment request").asRuntimeException());
        } catch (Exception e) {
            log.error("requestPayment failed exceptionType={}", e.getClass().getSimpleName());
            responseObserver.onError(Status.INTERNAL
                    .withDescription("Payment request failed").asRuntimeException());
        }
    }

    private static com.vnshop.proto.v1.PaymentStatus toProtoStatus(
            com.vnshop.paymentservice.domain.PaymentStatus status) {
        return com.vnshop.proto.v1.PaymentStatus.valueOf("PAYMENT_STATUS_" + status.name());
    }

    private static Timestamp toTimestamp(java.time.Instant instant) {
        java.time.Instant value = instant == null ? java.time.Instant.now() : instant;
        return Timestamp.newBuilder().setSeconds(value.getEpochSecond()).setNanos(value.getNano()).build();
    }

    @Override
    public void getPaymentStatus(PaymentStatusRequest request,
                                 StreamObserver<PaymentStatusResponse> responseObserver) {
        try {
            if (request.getOrderId().isBlank()) {
                responseObserver.onError(Status.INVALID_ARGUMENT
                        .withDescription("orderId is required").asRuntimeException());
                return;
            }
            Payment payment = getPaymentStatusUseCase.getByOrderId(request.getOrderId());

            responseObserver.onNext(PaymentStatusResponse.newBuilder()
                    .setPaymentId(payment.paymentId().toString())
                    .setStatus(payment.status().name())
                    .setStatusCode(toProtoStatus(payment.status()))
                    .build());
            responseObserver.onCompleted();
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid payment status request").asRuntimeException());
        } catch (Exception e) {
            log.error("getPaymentStatus failed exceptionType={}", e.getClass().getSimpleName());
            responseObserver.onError(Status.INTERNAL
                    .withDescription("Payment status request failed").asRuntimeException());
        }
    }

    private static PaymentMethodInput toMethodInput(PaymentRequest request) {
        String legacy = request.getPaymentMethod().isBlank() ? null : request.getPaymentMethod().toUpperCase();
        String typed = request.getMethod() == PaymentMethod.PAYMENT_METHOD_UNSPECIFIED
                ? null : request.getMethod().name().substring("PAYMENT_METHOD_".length());
        if (legacy != null && typed != null && !legacy.equals(typed)) {
            throw new IllegalArgumentException("payment method fields disagree");
        }
        String value = typed == null ? legacy : typed;
        if (value == null) {
            throw new IllegalArgumentException("payment method is required");
        }
        return PaymentMethodInput.valueOf(value);
    }

    private static PaymentFailureCode toFailureCode(Payment payment) {
        if (payment.status() != com.vnshop.paymentservice.domain.PaymentStatus.FAILED
                && payment.status() != com.vnshop.paymentservice.domain.PaymentStatus.PAYMENT_TIMEOUT) {
            return PaymentFailureCode.PAYMENT_FAILURE_CODE_UNSPECIFIED;
        }
        return PaymentFailureCode.PAYMENT_FAILURE_CODE_PROVIDER_FAILED;
    }
}
