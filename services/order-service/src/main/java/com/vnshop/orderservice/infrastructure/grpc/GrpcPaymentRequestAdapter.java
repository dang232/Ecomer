package com.vnshop.orderservice.infrastructure.grpc;

import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.proto.v1.PaymentRequest;
import com.vnshop.proto.v1.PaymentServiceGrpc;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

@Component
@ConditionalOnBean(PaymentServiceGrpc.PaymentServiceBlockingStub.class)
public class GrpcPaymentRequestAdapter implements PaymentRequestPort {

    private static final Logger log = LoggerFactory.getLogger(GrpcPaymentRequestAdapter.class);

    private final PaymentServiceGrpc.PaymentServiceBlockingStub paymentStub;
    private final CircuitBreaker circuitBreaker;

    public GrpcPaymentRequestAdapter(
            PaymentServiceGrpc.PaymentServiceBlockingStub paymentStub,
            CircuitBreaker paymentCircuitBreaker) {
        this.paymentStub = Objects.requireNonNull(paymentStub, "paymentStub is required");
        this.circuitBreaker = Objects.requireNonNull(paymentCircuitBreaker, "paymentCircuitBreaker is required");
    }

    @Override
    public void requestPayment(String orderId, String buyerId, String paymentMethod, Money amount) {
        var protoMoney = com.vnshop.proto.v1.Money.newBuilder()
            .setAmount(amount.amount().toPlainString())
            .setCurrency(amount.currency())
            .build();

        var request = PaymentRequest.newBuilder()
            .setOrderId(orderId)
            .setBuyerId(buyerId)
            .setPaymentMethod(paymentMethod)
            .setAmount(protoMoney)
            .setIdempotencyKey(orderId)
            .setMethod(toProtoMethod(paymentMethod))
            .setIdempotencyScope(com.vnshop.proto.v1.IdempotencyScope.IDEMPOTENCY_SCOPE_ORDER_PAYMENT)
            .build();

        try {
            com.vnshop.proto.v1.PaymentResponse response = circuitBreaker.executeSupplier(() ->
                paymentStub
                    .withDeadlineAfter(2500, TimeUnit.MILLISECONDS)
                    .requestPayment(request));
            if (response.getStatusCode() == com.vnshop.proto.v1.PaymentStatus.PAYMENT_STATUS_FAILED
                    || response.getStatusCode() == com.vnshop.proto.v1.PaymentStatus.PAYMENT_STATUS_PAYMENT_TIMEOUT
                    || response.getStatusCode() == com.vnshop.proto.v1.PaymentStatus.PAYMENT_STATUS_UNSPECIFIED) {
                throw new PaymentException(response.getFailureCode().name(),
                        "Payment request returned " + response.getStatusCode(), null);
            }
            log.info("Payment requested: orderId={}, paymentId={}, status={}, replayed={}, processedAt={}",
                orderId, response.getPaymentId(), response.getStatusCode(), response.getReplayed(), response.getProcessedAt());
        } catch (CallNotPermittedException e) {
            log.error("Circuit breaker OPEN for payment-service: {}", e.getMessage());
            throw new PaymentException("PAYMENT_SERVICE_UNAVAILABLE", "Payment service unavailable", e);
        } catch (StatusRuntimeException e) {
            log.error("gRPC payment request failed: orderId={}, code={}, message={}",
                orderId, e.getStatus().getCode(), e.getStatus().getDescription(), e);
            throw new PaymentException("PAYMENT_REQUEST_FAILED", "Payment request failed", e);
        }
    }

    private static com.vnshop.proto.v1.PaymentMethod toProtoMethod(String paymentMethod) {
        return switch (paymentMethod.toUpperCase(Locale.ROOT)) {
            case "COD" -> com.vnshop.proto.v1.PaymentMethod.PAYMENT_METHOD_COD;
            case "VNPAY" -> com.vnshop.proto.v1.PaymentMethod.PAYMENT_METHOD_VNPAY;
            case "MOMO" -> com.vnshop.proto.v1.PaymentMethod.PAYMENT_METHOD_MOMO;
            case "VIETQR" -> com.vnshop.proto.v1.PaymentMethod.PAYMENT_METHOD_VIETQR;
            case "STRIPE" -> com.vnshop.proto.v1.PaymentMethod.PAYMENT_METHOD_STRIPE;
            case "PAYPAL" -> com.vnshop.proto.v1.PaymentMethod.PAYMENT_METHOD_PAYPAL;
            default -> throw new IllegalArgumentException("Unsupported payment method: " + paymentMethod);
        };
    }
}
