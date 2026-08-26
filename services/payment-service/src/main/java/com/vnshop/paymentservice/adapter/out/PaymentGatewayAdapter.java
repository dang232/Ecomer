package com.vnshop.paymentservice.adapter.out;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentGatewayPort;
import com.vnshop.paymentservice.infrastructure.gateway.CompositePaymentGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import com.vnshop.paymentservice.infrastructure.metrics.PaymentMetrics;
import io.micrometer.core.instrument.Timer;

/**
 * Primary {@link PaymentGatewayPort} implementation that wraps {@link CompositePaymentGateway}.
 * Circuit breaker is applied at the CompositePaymentGateway level.
 */
@Primary
@Component
public class PaymentGatewayAdapter implements PaymentGatewayPort {
    private static final Logger log = LoggerFactory.getLogger(PaymentGatewayAdapter.class);

    private final CompositePaymentGateway delegate;
    private final PaymentMetrics metrics;

    public PaymentGatewayAdapter(CompositePaymentGateway delegate, PaymentMetrics metrics) {
        this.delegate = delegate;
        this.metrics = metrics;
    }

    @Override
    public GatewayPaymentResult processPayment(Payment payment) {
        log.debug("Processing payment via gateway: paymentId={}, method={}",
                payment.paymentId(), payment.method());
        Timer.Sample sample = metrics.startProviderTimer();
        try {
            return delegate.processPayment(payment);
        } finally {
            metrics.stopProviderTimer(sample);
        }
    }

    @Override
    public PaymentStatus getStatus(String paymentId) {
        log.debug("Getting payment status via gateway: paymentId={}", paymentId);
        return delegate.getStatus(paymentId);
    }
}
