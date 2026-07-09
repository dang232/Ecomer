package com.vnshop.paymentservice.infrastructure.gateway;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentGatewayPort;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Single {@link PaymentGatewayPort} bean that dispatches to a per-method
 * {@link PaymentMethodHandler}. Handlers are flag-gated via
 * {@code payment.<method>.enabled} — methods whose flag is off (or whose
 * dependencies aren't configured) leave their handler out of the context, so
 * dispatch surfaces a {@code METHOD_DISABLED} failure that the caller can
 * translate into a 4xx instead of a 500.
 *
 * <p>Circuit breaker opens after 5 failures within a sliding window of 10 calls.
 */
@Component
@CircuitBreaker(name = "paymentGateway", fallbackMethod = "processPaymentFallback")
public class CompositePaymentGateway implements PaymentGatewayPort {
    private static final Logger log = LoggerFactory.getLogger(CompositePaymentGateway.class);

    private final Map<PaymentMethod, PaymentMethodHandler> handlers;

    public CompositePaymentGateway(List<PaymentMethodHandler> handlers) {
        Map<PaymentMethod, PaymentMethodHandler> byMethod = new EnumMap<>(PaymentMethod.class);
        for (PaymentMethodHandler handler : handlers) {
            PaymentMethodHandler existing = byMethod.put(handler.method(), handler);
            if (existing != null) {
                throw new IllegalStateException(
                        "Multiple handlers registered for " + handler.method()
                                + ": " + existing.getClass().getSimpleName()
                                + " and " + handler.getClass().getSimpleName());
            }
        }
        this.handlers = byMethod;
        log.info("payment-handlers enabled: {}", byMethod.keySet());
    }

    @Override
    public GatewayPaymentResult processPayment(Payment payment) {
        PaymentMethodHandler handler = handlers.get(payment.method());
        if (handler == null) {
            log.warn("payment-method-disabled method={} paymentId={} orderId={}",
                    payment.method(), payment.paymentId(), payment.orderId());
            return new GatewayPaymentResult(PaymentStatus.FAILED, "METHOD_DISABLED");
        }
        return handler.processPayment(payment);
    }

    @Override
    public PaymentStatus getStatus(String paymentId) {
        return PaymentStatus.PENDING;
    }

    public boolean isMethodEnabled(PaymentMethod method) {
        return handlers.containsKey(method);
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
}
