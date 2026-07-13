package com.vnshop.orderservice.infrastructure.grpc;

import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.port.out.PaymentRequestPort;
import com.vnshop.proto.payment.PaymentRequest;
import com.vnshop.proto.payment.PaymentServiceGrpc;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;

import java.util.Objects;
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
        var protoMoney = com.vnshop.proto.common.Money.newBuilder()
            .setAmount(amount.amount().toPlainString())
            .setCurrency(amount.currency())
            .build();

        var request = PaymentRequest.newBuilder()
            .setOrderId(orderId)
            .setBuyerId(buyerId)
            .setPaymentMethod(paymentMethod)
            .setAmount(protoMoney)
            .build();

        try {
            var response = circuitBreaker.executeSupplier(() ->
                paymentStub
                    .withDeadlineAfter(10, TimeUnit.SECONDS)
                    .requestPayment(request));
            log.info("Payment requested: orderId={}, paymentId={}, status={}",
                orderId, response.getPaymentId(), response.getStatus());
        } catch (CallNotPermittedException e) {
            log.error("Circuit breaker OPEN for payment-service: {}", e.getMessage());
            throw new PaymentRequestFailedException("Payment service unavailable (circuit open)", e);
        } catch (StatusRuntimeException e) {
            log.error("gRPC payment request failed: orderId={}, code={}, message={}",
                orderId, e.getStatus().getCode(), e.getStatus().getDescription(), e);
            throw new PaymentRequestFailedException("Payment request failed for order " + orderId, e);
        }
    }
}
