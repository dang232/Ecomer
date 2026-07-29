package com.vnshop.paymentservice.infrastructure.stripe;

import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.port.out.FxRatePort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.Objects;

/**
 * Wraps the Stripe Java SDK for the bits we use: creating a PaymentIntent and
 * verifying webhook signatures. Active only when {@code payment.stripe.enabled=true}.
 *
 * <p>Amount conversion: the order is denominated in VND, Stripe charges in USD
 * cents. We convert via {@link FxRatePort} (Frankfurter ECB-sourced, with a
 * pinned fallback) and stash {@code paymentId}, {@code orderId}, {@code vndAmount},
 * and {@code fxRate} in the PaymentIntent metadata so the webhook handler can
 * find the original payment without an extra DB lookup keyed off the intent id.
 *
 * <p>The constructor validates {@code secretKey} and {@code webhookSecret} are
 * non-blank — bean creation fails at startup if Stripe is enabled but creds are
 * missing, instead of silently 500-ing on the first checkout.
 */
@Component
@ConditionalOnProperty(name = "payment.stripe.enabled", havingValue = "true")
public class StripeGateway {
    private final StripeProperties properties;
    private final FxRatePort fxRatePort;
    private final StripeIntentClient intentClient;

    public StripeGateway(StripeProperties properties, FxRatePort fxRatePort, StripeIntentClient intentClient) {
        this.properties = Objects.requireNonNull(properties, "properties is required");
        this.fxRatePort = Objects.requireNonNull(fxRatePort, "fxRatePort is required");
        this.intentClient = Objects.requireNonNull(intentClient, "intentClient is required");
        requireNonBlank(properties.secretKey(), "Stripe secret key is required");
        requireNonBlank(properties.webhookSecret(), "Stripe webhook secret is required");
    }

    public StripeIntent createPaymentIntent(Payment payment) throws StripeException {
        return createPaymentIntent(payment, "create:stripe:" + payment.paymentId());
    }

    /** Uses a server-derived provider key so browser retry keys never define a monetary identity. */
    public StripeIntent createPaymentIntent(Payment payment, String providerCreateKey) throws StripeException {
        requireNonBlank(providerCreateKey, "Stripe provider create key is required");
        ExternalAmount external = externalAmount(payment);
        BigDecimal vndAmount = payment.amount();
        BigDecimal rate = external.fxRate();
        // Stripe uses smallest unit (cents). Round up so we never under-charge.
        BigDecimal usdAmount = external.amount();
        long usdCents = usdAmount.multiply(new BigDecimal("100")).setScale(0, RoundingMode.HALF_UP).longValueExact();

        PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setAmount(usdCents)
                .setCurrency("usd")
                .putMetadata("paymentId", payment.paymentId().toString())
                .putMetadata("orderId", payment.orderId())
                .putMetadata("vndAmount", vndAmount.toPlainString())
                .putMetadata("fxRate", rate.toPlainString())
                .setAutomaticPaymentMethods(
                        PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                                .setEnabled(true)
                                .build())
                .build();

        PaymentIntent intent = intentClient.create(params, requestOptions(providerCreateKey));
        return new StripeIntent(
                intent.getId(),
                intent.getClientSecret(),
                usdAmount.setScale(2, RoundingMode.HALF_UP),
                "USD",
                rate);
    }

    public StripeProperties properties() {
        return properties;
    }

    private ExternalAmount externalAmount(Payment payment) {
        if (payment.externalAmount() != null
                && payment.externalCurrency() != null
                && payment.fxRate() != null) {
            if (!"USD".equalsIgnoreCase(payment.externalCurrency())) {
                throw new IllegalArgumentException("Stripe external currency must be USD");
            }
            return new ExternalAmount(payment.externalAmount(), payment.fxRate());
        }
        BigDecimal rate = fxRatePort.rate("VND", "USD");
        return new ExternalAmount(payment.amount().multiply(rate).setScale(2, RoundingMode.HALF_UP), rate);
    }

    private RequestOptions requestOptions(String idempotencyKey) {
        return RequestOptions.builder()
                .setApiKey(properties.secretKey())
                .setIdempotencyKey(idempotencyKey)
                .build();
    }

    private static void requireNonBlank(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
    }

    /**
     * Provider-specific extras returned by {@link #createPaymentIntent(Payment)}.
     * The FE needs {@code clientSecret} to mount the Elements provider; the BE
     * persists {@code externalAmount}, {@code externalCurrency}, and
     * {@code fxRate} for dispute reconciliation.
     */
    public record StripeIntent(
            String intentId,
            String clientSecret,
            BigDecimal externalAmount,
            String externalCurrency,
            BigDecimal fxRate) {
        public Map<String, String> metadataView() {
            return Map.of(
                    "intentId", intentId,
                    "externalAmount", externalAmount.toPlainString(),
                    "externalCurrency", externalCurrency,
                    "fxRate", fxRate.toPlainString());
        }
    }

    private record ExternalAmount(BigDecimal amount, BigDecimal fxRate) {
    }
}
