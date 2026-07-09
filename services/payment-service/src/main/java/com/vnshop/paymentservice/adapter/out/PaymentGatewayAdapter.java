package com.vnshop.paymentservice.adapter.out;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentGatewayPort;
import com.vnshop.paymentservice.infrastructure.gateway.CompositePaymentGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Primary {@link PaymentGatewayPort} implementation that wraps {@link CompositePaymentGateway}.
 * Circuit breaker is applied at the CompositePaymentGateway level.
 */
@Primary
@Component
public class PaymentGatewayAdapter implements PaymentGatewayPort {
    private static final Logger log = LoggerFactory.getLogger(PaymentGatewayAdapter.class);

    private final CompositePaymentGateway delegate;

    public PaymentGatewayAdapter(CompositePaymentGateway delegate) {
        this.delegate = delegate;
    }

    @Override
    public GatewayPaymentResult processPayment(Payment payment) {
        log.debug("Processing payment via gateway: paymentId={}, method={}",
                payment.paymentId(), payment.method());
        return delegate.processPayment(payment);
    }

    @Override
    public PaymentStatus getStatus(String paymentId) {
        log.debug("Getting payment status via gateway: paymentId={}", paymentId);
        return delegate.getStatus(paymentId);
    }
}
