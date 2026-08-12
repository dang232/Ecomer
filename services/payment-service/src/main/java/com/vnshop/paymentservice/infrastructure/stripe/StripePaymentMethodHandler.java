package com.vnshop.paymentservice.infrastructure.stripe;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentGatewayPort;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentMethodHandler;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Marks STRIPE as an enabled method in the composite gateway. The actual
 * PaymentIntent creation runs in the controller (mirrors the VietQR pattern):
 * use {@code ProcessPaymentUseCase.process} to persist the PENDING row, then
 * {@link StripeGateway#createPaymentIntent} to build the SDK call. This handler
 * stays a stub so {@link PaymentGatewayPort} doesn't have to grow a string-bag
 * for SDK extras.
 */
@Component
@ConditionalOnProperty(name = "payment.stripe.enabled", havingValue = "true")
public class StripePaymentMethodHandler implements PaymentMethodHandler {
    @Override
    public PaymentMethod method() {
        return PaymentMethod.STRIPE;
    }

    @Override
    public PaymentGatewayPort.GatewayPaymentResult processPayment(Payment payment) {
        return new PaymentGatewayPort.GatewayPaymentResult(PaymentStatus.PENDING, null);
    }
}
