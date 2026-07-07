package com.vnshop.paymentservice.adapter.out;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentGatewayPort;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.concurrent.Callable;

/**
 * Circuit breaker wrapper around {@link PaymentGatewayPort}.
 * 
 * <p>Opens the circuit after 5 failures (within a sliding window of 10 calls),
 * preventing cascading failures when external payment gateways are down.
 * Provides fallback responses when the circuit is open.
 * 
 * <p>Payment gateways wrapped: VNPay, MoMo, VietQR, Stripe, PayPal.
 */
@Component
public class PaymentGatewayAdapter implements PaymentGatewayPort {
    private static final Logger log = LoggerFactory.getLogger(PaymentGatewayAdapter.class);
    private static final String CIRCUIT_BREAKER_NAME = "paymentGateway";

    private final PaymentGatewayPort delegate;

    public PaymentGatewayAdapter(PaymentGatewayPort delegate) {
        this.delegate = delegate;
    }

    @Override
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "processPaymentFallback")
    public GatewayPaymentResult processPayment(Payment payment) {
        log.debug("Processing payment via gateway: paymentId={}, method={}", 
                payment.paymentId(), payment.method());
        return delegate.processPayment(payment);
    }

    /**
     * Fallback when circuit breaker is open or call fails.
     * Returns a FAILED status with service unavailable message.
     */
    @SuppressWarnings("unused")
    private GatewayPaymentResult processPaymentFallback(Payment payment, Throwable throwable) {
        log.warn("Circuit breaker triggered for processPayment: paymentId={}, error={}", 
                payment.paymentId(), throwable.getMessage());
        return new GatewayPaymentResult(PaymentStatus.FAILED, "SERVICE_TEMPORARILY_UNAVAILABLE");
    }

    @Override
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME, fallbackMethod = "getStatusFallback")
    public PaymentStatus getStatus(String paymentId) {
        log.debug("Getting payment status via gateway: paymentId={}", paymentId);
        return delegate.getStatus(paymentId);
    }

    /**
     * Fallback when circuit breaker is open or call fails.
     * Returns PENDING status to avoid blocking payment flow.
     */
    @SuppressWarnings("unused")
    private PaymentStatus getStatusFallback(String paymentId, Throwable throwable) {
        log.warn("Circuit breaker triggered for getStatus: paymentId={}, error={}", 
                paymentId, throwable.getMessage());
        return PaymentStatus.PENDING;
    }
}
