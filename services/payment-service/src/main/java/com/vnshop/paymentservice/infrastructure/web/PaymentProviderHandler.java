package com.vnshop.paymentservice.infrastructure.web;

import com.stripe.exception.StripeException;
import com.vnshop.paymentservice.application.PaymentMethodInput;
import com.vnshop.paymentservice.application.ProviderInitializationService;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.infrastructure.gateway.VietQrService;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalGateway;
import com.vnshop.paymentservice.infrastructure.stripe.StripeGateway;

import java.util.Optional;

final class PaymentProviderHandler {
    private final PaymentOperationRegistry registry;
    private final Optional<VietQrService> vietQrService;
    private final Optional<StripeGateway> stripeGateway;
    private final Optional<PayPalGateway> payPalGateway;
    private final ProviderInitializationService initializationService;

    PaymentProviderHandler(PaymentOperationRegistry registry, Optional<VietQrService> vietQrService,
            Optional<StripeGateway> stripeGateway, Optional<PayPalGateway> payPalGateway,
            ProviderInitializationService initializationService) {
        this.registry = registry;
        this.vietQrService = vietQrService;
        this.stripeGateway = stripeGateway;
        this.payPalGateway = payPalGateway;
        this.initializationService = initializationService;
    }

    ApiResponse<VietQrCreateResponse> createVietQr(PaymentRequest request, String idempotencyKey) {
        VietQrService qrService = vietQrService.orElseThrow(() ->
                new IllegalStateException("VietQR is not enabled — set payment.vietqr.enabled=true"));
        Payment payment = registry.processOrReuse(request.orderId(), PaymentMethodInput.VIETQR, idempotencyKey);
        VietQrService.VietQrPayment qr = qrService.generate(payment.paymentId().toString(), payment.amount());
        return ApiResponse.ok(new VietQrCreateResponse(PaymentResponse.fromDomain(payment), qr.qrImageUrl(),
                qr.bankBin(), qr.accountNo(), qr.accountName(), qr.reference()));
    }

    ApiResponse<PayPalCreateResponse> createPayPal(PaymentRequest request, String idempotencyKey) {
        PayPalGateway gateway = payPalGateway.orElseThrow(() ->
                new IllegalStateException("PayPal is not enabled — set payment.paypal.enabled=true"));
        Payment payment = initializationService.freezeExternalAmount(
                registry.processOrReuse(request.orderId(), PaymentMethodInput.PAYPAL, idempotencyKey).paymentId());
        PayPalGateway.PayPalOrder order = gateway.createOrder(payment, "create:paypal:" + payment.paymentId());
        Payment enriched = initializationService.persistProviderReference(payment.paymentId(), order.paypalOrderId());
        return ApiResponse.ok(PayPalCreateResponse.of(enriched, gateway.properties().clientId(), order.paypalOrderId(),
                order.status(), order.externalAmount(), order.externalCurrency(), order.fxRate()));
    }

    ApiResponse<StripeCreateResponse> createStripe(PaymentRequest request, String idempotencyKey)
            throws StripeException {
        StripeGateway gateway = stripeGateway.orElseThrow(() ->
                new IllegalStateException("Stripe is not enabled — set payment.stripe.enabled=true"));
        Payment payment = initializationService.freezeExternalAmount(
                registry.processOrReuse(request.orderId(), PaymentMethodInput.STRIPE, idempotencyKey).paymentId());
        StripeGateway.StripeIntent intent = gateway.createPaymentIntent(payment, "create:stripe:" + payment.paymentId());
        Payment enriched = initializationService.persistProviderReference(payment.paymentId(), intent.intentId());
        return ApiResponse.ok(StripeCreateResponse.of(enriched, gateway.properties().publishableKey(), intent.clientSecret(),
                intent.intentId(), intent.externalAmount(), intent.externalCurrency(), intent.fxRate()));
    }
}
