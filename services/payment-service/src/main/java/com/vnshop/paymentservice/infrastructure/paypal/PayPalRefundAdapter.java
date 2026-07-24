package com.vnshop.paymentservice.infrastructure.paypal;

import com.vnshop.paymentservice.domain.port.out.FxRatePort;
import com.vnshop.paymentservice.domain.port.out.RefundGatewayPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

/**
 * Issues refunds against a captured PayPal payment by delegating to
 * {@link PayPalGateway#refund}. The {@code gatewayTransactionId} on a
 * PayPal-backed {@link com.vnshop.paymentservice.domain.Payment} is the
 * capture ID returned when the buyer completed checkout.
 *
 * <p>Idempotency is handled by PayPal via the {@code PayPal-Request-Id} header;
 * we pass the internal {@code paymentId} as the key so retries collapse without
 * issuing money twice.
 *
 * <p>Bean is gated on {@code payment.paypal.enabled=true} — same condition as
 * {@link PayPalGateway} itself.
 */
@Component
@ConditionalOnProperty(name = "payment.paypal.enabled", havingValue = "true")
public class PayPalRefundAdapter implements RefundGatewayPort {

    private static final Logger log = LoggerFactory.getLogger(PayPalRefundAdapter.class);

    private final PayPalGateway gateway;
    private final FxRatePort fxRatePort;

    public PayPalRefundAdapter(PayPalGateway gateway, FxRatePort fxRatePort) {
        this.gateway = Objects.requireNonNull(gateway, "gateway is required");
        this.fxRatePort = Objects.requireNonNull(fxRatePort, "fxRatePort is required");
    }

    @Override
    public boolean supports(String paymentMethod) {
        return "PAYPAL".equalsIgnoreCase(paymentMethod);
    }

    /**
     * @param paymentId            internal payment UUID — used as idempotency key
     * @param gatewayTransactionId PayPal capture ID stored as the transactionRef
     * @param amount               buyer-facing VND amount; converted to USD before
     *                             the API call
     * @param reason               informational only (PayPal v2 captures refund has
     *                             no reason field in the request body)
     * @return PayPal refund id
     */
    @Override
    public String refund(String paymentId, String gatewayTransactionId, BigDecimal amount, String reason) {
        return refund(paymentId, gatewayTransactionId, amount, reason, paymentId);
    }

    @Override
    public String refund(String paymentId, String gatewayTransactionId, BigDecimal amount, String reason, String reversalId) {
        Objects.requireNonNull(paymentId, "paymentId is required");
        Objects.requireNonNull(gatewayTransactionId, "gatewayTransactionId is required");
        Objects.requireNonNull(amount, "amount is required");

        BigDecimal rate = fxRatePort.rate("VND", "USD");
        BigDecimal usdAmount = amount.multiply(rate).setScale(2, RoundingMode.HALF_UP);

        PayPalGateway.PayPalRefund refund = gateway.refund(gatewayTransactionId, usdAmount, reversalId);
        log.info("paypal-refund-issued paymentId={} captureId={} refundId={} status={}",
                paymentId, gatewayTransactionId, refund.refundId(), refund.status());
        return refund.refundId();
    }
}
