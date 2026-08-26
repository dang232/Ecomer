package com.vnshop.paymentservice.infrastructure.config;

import com.vnshop.paymentservice.infrastructure.gateway.MomoProperties;
import com.vnshop.paymentservice.infrastructure.gateway.VnpayProperties;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalProperties;
import com.vnshop.paymentservice.infrastructure.sepay.SepayProperties;
import com.vnshop.paymentservice.infrastructure.stripe.StripeProperties;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Validates that every enabled payment method has the required credentials
 * present at startup. Throws {@link IllegalStateException} on the first
 * misconfigured method so a bad deploy fails fast with a clear message
 * instead of silently 500-ing on the first checkout request.
 *
 * <p>COD requires no credentials. VietQR, SePay, Stripe, PayPal,
 * VNPay, and MoMo each require at least one non-blank credential when enabled.
 */
@Component
public class PaymentMethodValidator {

    private static final Logger log = LoggerFactory.getLogger(PaymentMethodValidator.class);

    @Value("${payment.cod.enabled:true}")
    private boolean codEnabled;

    @Value("${payment.vietqr.enabled:false}")
    private boolean vietqrEnabled;

    @Value("${vietqr.account-no:}")
    private String vietqrAccountNo;

    @Value("${vietqr.account-name:}")
    private String vietqrAccountName;

    @Value("${payment.vnpay." +
            "enabled:false}")
    private boolean deferredGatewayAEnabled;

    @Value("${payment.momo." +
            "enabled:false}")
    private boolean deferredGatewayBEnabled;

    @Value("${payment.provider-policy.non-production-gate:false}")
    private boolean nonProductionGate;

    @Value("${spring.profiles.active:}")
    private String activeProfiles;

    @Value("${vnshop.public-api-url:}")
    private String publicApiUrl;

    @Value("${vnshop.frontend-url:}")
    private String frontendUrl;

    private final StripeProperties stripeProperties;
    private final PayPalProperties payPalProperties;
    private final VnpayProperties vnpayProperties;
    private final MomoProperties momoProperties;
    private final SepayProperties sepayProperties;

    public PaymentMethodValidator(
            StripeProperties stripeProperties,
            PayPalProperties payPalProperties,
            VnpayProperties vnpayProperties,
            MomoProperties momoProperties,
            SepayProperties sepayProperties) {
        this.stripeProperties = stripeProperties;
        this.payPalProperties = payPalProperties;
        this.vnpayProperties = vnpayProperties;
        this.momoProperties = momoProperties;
        this.sepayProperties = sepayProperties;
    }

    @PostConstruct
    public void validate() {
        List<String> errors = new ArrayList<>();

        if (deferredGatewayAEnabled && !nonProductionGate) {
            errors.add("Payment policy requires PAYMENT_NON_PRODUCTION_GATE=true for deferred gateway A outside production");
        }
        if (deferredGatewayBEnabled && !nonProductionGate) {
            errors.add("Payment policy requires PAYMENT_NON_PRODUCTION_GATE=true for deferred gateway B outside production");
        }
        if (isProductionProfile() && (deferredGatewayAEnabled || deferredGatewayBEnabled)) {
            errors.add("Deferred gateways cannot be enabled with the production Spring profile");
        }

        if (codEnabled) {
            log.info("Payment method enabled: COD (no credentials required)");
        }

        if (vietqrEnabled) {
            if (isBlank(vietqrAccountNo)) {
                errors.add("VIETQR_ENABLED=true but VIETQR_ACCOUNT_NO is not set");
            }
            if (isBlank(vietqrAccountName)) {
                errors.add("VIETQR_ENABLED=true but VIETQR_ACCOUNT_NAME is not set");
            }
            if (errors.isEmpty()) {
                log.info("Payment method enabled: VietQR");
            }
        }

        if (sepayProperties.enabled()) {
            if (isBlank(sepayProperties.apiKey())) {
                errors.add("SEPAY_ENABLED=true but SEPAY_API_KEY is not set");
            }
            if (isBlank(sepayProperties.accountId())) {
                errors.add("SEPAY_ENABLED=true but SEPAY_ACCOUNT_ID is not set");
            }
            if (errors.isEmpty()) {
                log.info("Payment method enabled: SePay");
            }
        }

        if (stripeProperties.enabled()) {
            if (isBlank(stripeProperties.secretKey())) {
                errors.add("STRIPE_ENABLED=true but STRIPE_SECRET_KEY is not set");
            }
            if (isBlank(stripeProperties.webhookSecret())) {
                errors.add("STRIPE_ENABLED=true but STRIPE_WEBHOOK_SECRET is not set");
            }
            if (isBlank(stripeProperties.publishableKey())) {
                errors.add("STRIPE_ENABLED=true but STRIPE_PUBLISHABLE_KEY is not set");
            }
            if (errors.isEmpty()) {
                log.info("Payment method enabled: Stripe");
            }
        }

        if (payPalProperties.enabled()) {
            if (isBlank(payPalProperties.clientId())) {
                errors.add("PAYPAL_ENABLED=true but PAYPAL_CLIENT_ID is not set");
            }
            if (isBlank(payPalProperties.clientSecret())) {
                errors.add("PAYPAL_ENABLED=true but PAYPAL_CLIENT_SECRET is not set");
            }
            if (errors.isEmpty()) {
                log.info("Payment method enabled: PayPal (mode={})", payPalProperties.mode());
            }
        }

        if (deferredGatewayAEnabled) {
            if (isBlank(vnpayProperties.tmnCode())) {
                errors.add("VNPay configuration is missing VNPAY_TMN_CODE");
            }
            if (isBlank(vnpayProperties.hashSecret())) {
                errors.add("VNPay configuration is missing VNPAY_HASH_SECRET");
            }
            errors.addAll(PublicPaymentCallbackUrls.validate(
                    "VNPay",
                    publicApiUrl,
                    frontendUrl,
                    vnpayProperties.returnUrl(),
                    vnpayProperties.ipnUrl()));
            if (errors.isEmpty()) {
                log.info("Payment method enabled: VNPay");
            }
        }

        if (deferredGatewayBEnabled) {
            if (isBlank(momoProperties.partnerCode())) {
                errors.add("MoMo configuration is missing MOMO_PARTNER_CODE");
            }
            if (isBlank(momoProperties.accessKey())) {
                errors.add("MoMo configuration is missing MOMO_ACCESS_KEY");
            }
            if (isBlank(momoProperties.secretKey())) {
                errors.add("MoMo configuration is missing MOMO_SECRET_KEY");
            }
            errors.addAll(PublicPaymentCallbackUrls.validate(
                    "MoMo",
                    publicApiUrl,
                    frontendUrl,
                    momoProperties.redirectUrl(),
                    momoProperties.ipnUrl()));
            if (errors.isEmpty()) {
                log.info("Payment method enabled: MoMo");
            }
        }

        if (!errors.isEmpty()) {
            throw new IllegalStateException(
                    "Payment service startup failed — missing credentials for enabled methods:\n  - "
                            + String.join("\n  - ", errors)
                            + "\nSet the required environment variables or disable the method.");
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean isProductionProfile() {
        return java.util.Arrays.stream(activeProfiles.split(","))
                .map(String::trim)
                .anyMatch(profile -> profile.equalsIgnoreCase("prod") || profile.equalsIgnoreCase("production"));
    }
}
