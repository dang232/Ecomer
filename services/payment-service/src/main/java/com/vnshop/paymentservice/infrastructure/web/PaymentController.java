package com.vnshop.paymentservice.infrastructure.web;

import com.stripe.exception.StripeException;
import com.vnshop.paymentservice.application.GetPaymentStatusUseCase;
import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.application.ProcessPaymentUseCase;
import com.vnshop.paymentservice.application.ProviderInitializationService;
import com.vnshop.paymentservice.application.UnsupportedPaymentMethodException;
import com.vnshop.paymentservice.infrastructure.gateway.MomoCallbackService;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackEventStore;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
import com.vnshop.paymentservice.infrastructure.gateway.VietQrService;
import com.vnshop.paymentservice.infrastructure.gateway.VnpayCallbackService;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalGateway;
import com.vnshop.paymentservice.infrastructure.stripe.StripeGateway;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/payment")
public class PaymentController {
    static final String IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

    private final PaymentBuyerHandler buyerHandler;
    private final PaymentProviderHandler providerHandler;
    private final PaymentCallbackHandler callbackHandler;
    private final PayPalCaptureHandler payPalCaptureHandler;

    @Value("${payment.provider-policy.deferred-gateway-a:false}")
    private boolean deferredGatewayAEnabled;

    @Value("${payment.provider-policy.deferred-gateway-b:false}")
    private boolean deferredGatewayBEnabled;

    public PaymentController(ProcessPaymentUseCase processPaymentUseCase,
            GetPaymentStatusUseCase getPaymentStatusUseCase,
            Optional<VnpayCallbackService> vnpayCallbackService,
            Optional<MomoCallbackService> momoCallbackService,
            Optional<VietQrService> vietQrService,
            Optional<StripeGateway> stripeGateway,
            Optional<PayPalGateway> payPalGateway,
            PaymentPromotionService promotionService,
            com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort paymentRepository,
            PaymentCallbackLogStore callbackLogStore,
            ProviderInitializationService providerInitializationService,
            PaymentCallbackEventStore callbackEventStore) {
        PaymentOperationRegistry registry = new PaymentOperationRegistry(processPaymentUseCase, paymentRepository);
        this.buyerHandler = new PaymentBuyerHandler(registry, getPaymentStatusUseCase, vietQrService);
        this.providerHandler = new PaymentProviderHandler(registry, vietQrService, stripeGateway, payPalGateway,
                providerInitializationService);
        this.callbackHandler = new PaymentCallbackHandler(vnpayCallbackService, momoCallbackService);
        this.payPalCaptureHandler = new PayPalCaptureHandler(payPalGateway, promotionService, paymentRepository,
                callbackLogStore, callbackEventStore);
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/cod/confirm")
    public ApiResponse<PaymentResponse> confirmCod(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody PaymentRequest request) {
        return buyerHandler.create(request, com.vnshop.paymentservice.application.PaymentMethodInput.COD, idempotencyKey);
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/vnpay/create")
    public ApiResponse<PaymentResponse> createVnpay(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody PaymentRequest request) {
        assertEnabled(deferredGatewayAEnabled, "deferred gateway A");
        return buyerHandler.create(request, com.vnshop.paymentservice.application.PaymentMethodInput.VNPAY, idempotencyKey);
    }

    @GetMapping("/vnpay/ipn")
    public ApiResponse<VnpayIpnResponse> vnpayIpn(@RequestParam Map<String, String> parameters,
            @RequestHeader Map<String, String> headers) {
        return callbackHandler.vnpayIpn(parameters, headers);
    }

    @GetMapping("/vnpay/return")
    public ApiResponse<VnpayReturnResponse> vnpayReturn(@RequestParam Map<String, String> parameters) {
        return callbackHandler.vnpayReturn(parameters);
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/momo/create")
    public ApiResponse<PaymentResponse> createMomo(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody PaymentRequest request) {
        assertEnabled(deferredGatewayBEnabled, "deferred gateway B");
        return buyerHandler.create(request, com.vnshop.paymentservice.application.PaymentMethodInput.MOMO, idempotencyKey);
    }

    @PostMapping("/momo/ipn")
    public ApiResponse<MomoIpnResponse> momoIpn(@RequestBody com.vnshop.paymentservice.infrastructure.gateway.MomoIpnRequest request,
            @RequestHeader Map<String, String> headers) {
        return callbackHandler.momoIpn(request, headers);
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/vietqr/create")
    public ApiResponse<VietQrCreateResponse> createVietQr(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody PaymentRequest request) {
        return providerHandler.createVietQr(request, idempotencyKey);
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/paypal/create")
    public ApiResponse<PayPalCreateResponse> createPayPal(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody PaymentRequest request) {
        return providerHandler.createPayPal(request, idempotencyKey);
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/paypal/capture/{paymentId}/{paypalOrderId}")
    public ApiResponse<PaymentResponse> capturePayPal(@PathVariable String paymentId,
            @PathVariable String paypalOrderId) {
        return payPalCaptureHandler.capture(paymentId, paypalOrderId);
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/status/{orderId}")
    public ApiResponse<PaymentResponse> status(@PathVariable String orderId) {
        return buyerHandler.status(orderId);
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/stripe/create")
    public ApiResponse<StripeCreateResponse> createStripe(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody PaymentRequest request) throws StripeException {
        return providerHandler.createStripe(request, idempotencyKey);
    }

    private static void assertEnabled(boolean enabled, String provider) {
        if (!enabled) {
            throw new UnsupportedPaymentMethodException(provider + " gateway is not enabled");
        }
    }
}
