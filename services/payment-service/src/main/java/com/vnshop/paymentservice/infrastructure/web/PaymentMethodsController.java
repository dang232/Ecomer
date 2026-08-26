package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.infrastructure.gateway.MomoProperties;
import com.vnshop.paymentservice.infrastructure.gateway.VnpayProperties;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalProperties;
import com.vnshop.paymentservice.infrastructure.sepay.SepayProperties;
import com.vnshop.paymentservice.infrastructure.stripe.StripeProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

/**
 * Returns the list of payment methods that are both enabled AND have their
 * required credentials configured. The frontend uses this to decide which
 * payment options to render at checkout.
 *
 * <p>Only methods that are ready for use are returned — a method that is
 * enabled but misconfigured (missing credentials) is excluded because the
 * validator would have already crashed startup in that case.
 */
@RestController
@RequestMapping("/payment")
public class PaymentMethodsController {

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

    private final StripeProperties stripeProperties;
    private final PayPalProperties payPalProperties;
    private final VnpayProperties vnpayProperties;
    private final MomoProperties momoProperties;
    private final SepayProperties sepayProperties;

    public PaymentMethodsController(
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

    /**
     * Returns only methods that are enabled and have credentials configured.
     * No auth required — the frontend needs this before a user is logged in
     * to decide which checkout options to render.
     */
    @GetMapping("/methods")
    public ApiResponse<List<PaymentMethodDto>> listMethods() {
        List<PaymentMethodDto> methods = new ArrayList<>();

        if (codEnabled) {
            methods.add(new PaymentMethodDto("cod", "Cash on Delivery", true));
        }

        if (vietqrEnabled && hasText(vietqrAccountNo) && hasText(vietqrAccountName)) {
            methods.add(new PaymentMethodDto("vietqr", "VietQR Bank Transfer", true));
        }

        if (sepayProperties.enabled()
                && hasText(sepayProperties.apiKey())
                && hasText(sepayProperties.accountId())) {
            methods.add(new PaymentMethodDto("sepay", "SePay", true));
        }

        if (stripeProperties.enabled()
                && hasText(stripeProperties.secretKey())
                && hasText(stripeProperties.publishableKey())
                && hasText(stripeProperties.webhookSecret())) {
            methods.add(new PaymentMethodDto("stripe", "Credit / Debit Card (Stripe)", true));
        }

        if (payPalProperties.enabled()
                && hasText(payPalProperties.clientId())
                && hasText(payPalProperties.clientSecret())) {
            methods.add(new PaymentMethodDto("paypal", "PayPal", true));
        }

        if (deferredGatewayAEnabled && nonProductionGate
                && hasText(vnpayProperties.tmnCode())
                && hasText(vnpayProperties.hashSecret())) {
            methods.add(new PaymentMethodDto("vnpay", "VNPay", true));
        }

        if (deferredGatewayBEnabled && nonProductionGate
                && hasText(momoProperties.partnerCode())
                && hasText(momoProperties.accessKey())
                && hasText(momoProperties.secretKey())) {
            methods.add(new PaymentMethodDto("momo", "MoMo", true));
        }

        return ApiResponse.ok(methods);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public record PaymentMethodDto(String id, String name, boolean enabled) {
    }
}
