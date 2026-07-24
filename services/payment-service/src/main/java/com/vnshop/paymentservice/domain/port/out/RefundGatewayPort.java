package com.vnshop.paymentservice.domain.port.out;

import java.math.BigDecimal;

/**
 * Secondary port: issue a money-back call to a payment gateway. Each provider
 * implements this interface and declares which {@link #supports} payment methods
 * it handles. {@link com.vnshop.paymentservice.application.RefundPaymentUseCase}
 * selects the right implementation at runtime.
 */
public interface RefundGatewayPort {

    /**
     * Returns true when this adapter can process refunds for the given payment
     * method name (matches {@link com.vnshop.paymentservice.domain.PaymentMethod}
     * enum name, e.g. {@code "STRIPE"}, {@code "PAYPAL"}).
     */
    boolean supports(String paymentMethod);

    /**
     * Issues the refund with the gateway and returns the gateway-assigned
     * refund identifier (e.g. Stripe {@code re_xxx} or PayPal refund id).
     *
     * @param paymentId            internal payment UUID (used as idempotency key)
     * @param gatewayTransactionId provider-side transaction reference stored on
     *                             the Payment entity (PaymentIntent ID / capture ID)
     * @param amount               buyer-facing amount in VND; adapters convert as needed
     * @param reason               human-readable reason forwarded to the gateway
     * @return provider refund id
     */
    String refund(String paymentId, String gatewayTransactionId, BigDecimal amount, String reason);

    /** Provider call with a business-stable idempotency key for partial refunds. */
    default String refund(String paymentId, String gatewayTransactionId, BigDecimal amount,
                          String reason, String reversalId) {
        return refund(paymentId, gatewayTransactionId, amount, reason);
    }
}
