package com.vnshop.paymentservice.infrastructure.stripe;

import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
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
 * Issues refunds against a Stripe PaymentIntent via the Stripe Java SDK.
 *
 * <p>The {@code gatewayTransactionId} stored on a Stripe-backed {@link
 * com.vnshop.paymentservice.domain.Payment} is the PaymentIntent ID (e.g.
 * {@code pi_xxx}). Stripe's Refund endpoint accepts this directly.
 *
 * <p>Amount conversion: the internal amount is VND; Stripe requires USD cents.
 * We use {@link FxRatePort} — the same source used at charge time — so the
 * refunded amount matches the original charge in terms of currency math.
 *
 * <p>Bean is gated on {@code payment.stripe.enabled=true}.
 */
@Component
@ConditionalOnProperty(name = "payment.stripe.enabled", havingValue = "true")
public class StripeRefundAdapter implements RefundGatewayPort {

    private static final Logger log = LoggerFactory.getLogger(StripeRefundAdapter.class);

    private final StripeProperties properties;
    private final FxRatePort fxRatePort;

    public StripeRefundAdapter(StripeProperties properties, FxRatePort fxRatePort) {
        this.properties = Objects.requireNonNull(properties, "properties is required");
        this.fxRatePort = Objects.requireNonNull(fxRatePort, "fxRatePort is required");
    }

    @Override
    public boolean supports(String paymentMethod) {
        return "STRIPE".equalsIgnoreCase(paymentMethod);
    }

    /**
     * @param paymentId            internal payment UUID — used as idempotency key
     * @param gatewayTransactionId Stripe PaymentIntent ID ({@code pi_xxx})
     * @param amount               buyer-facing VND amount to refund
     * @param reason               forwarded to Stripe (mapped to a valid reason enum value)
     * @return Stripe refund id ({@code re_xxx})
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
        long usdCents = amount.multiply(rate)
                .multiply(new BigDecimal("100"))
                .setScale(0, RoundingMode.HALF_UP)
                .longValueExact();

        RefundCreateParams.Builder paramsBuilder = RefundCreateParams.builder()
                .setPaymentIntent(gatewayTransactionId)
                .setAmount(usdCents);

        // Map free-text reason to Stripe's accepted enum values where possible.
        if (reason != null && reason.toLowerCase().contains("duplicate")) {
            paramsBuilder.setReason(RefundCreateParams.Reason.DUPLICATE);
        } else if (reason != null && reason.toLowerCase().contains("fraud")) {
            paramsBuilder.setReason(RefundCreateParams.Reason.FRAUDULENT);
        } else {
            paramsBuilder.setReason(RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER);
        }

        RequestOptions options = RequestOptions.builder()
                .setApiKey(properties.secretKey())
                .setIdempotencyKey("refund-" + reversalId)
                .build();

        try {
            Refund refund = Refund.create(paramsBuilder.build(), options);
            log.info("stripe-refund-issued paymentId={} intentId={} refundId={} status={}",
                    paymentId, gatewayTransactionId, refund.getId(), refund.getStatus());
            return refund.getId();
        } catch (StripeException ex) {
            log.warn("stripe-refund-failed paymentId={} intentId={} code={} message={}",
                    paymentId, gatewayTransactionId, ex.getCode(), ex.getMessage());
            throw new IllegalStateException("Stripe refund failed: " + ex.getMessage(), ex);
        }
    }
}
