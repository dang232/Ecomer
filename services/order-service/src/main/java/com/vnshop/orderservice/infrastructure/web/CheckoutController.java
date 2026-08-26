package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.CalculateCheckoutUseCase;
import com.vnshop.orderservice.application.shipping.ShippingOption;
import com.vnshop.orderservice.application.shipping.ShippingQuotePort;
import com.vnshop.orderservice.application.shipping.ShippingQuoteRequest;
import com.vnshop.orderservice.application.shipping.ShippingQuoteResult;
import com.vnshop.orderservice.infrastructure.shipping.ShippingException;
import com.vnshop.orderservice.infrastructure.config.JwtPrincipalUtil;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/checkout")
public class CheckoutController {

    @Value("${checkout.payment-methods.cod.enabled:true}")
    private boolean codEnabled = true;

    @Value("${checkout.payment-methods.vietqr.enabled:true}")
    private boolean vietqrEnabled = true;

    @Value("${checkout.payment-methods.deferred-gateway-a:false}")
    private boolean deferredGatewayAEnabled = false;

    @Value("${checkout.payment-methods.deferred-gateway-b:false}")
    private boolean deferredGatewayBEnabled = false;

    private final CalculateCheckoutUseCase calculateCheckoutUseCase;
    private final ShippingQuotePort shippingQuotePort;

    public CheckoutController(
            CalculateCheckoutUseCase calculateCheckoutUseCase,
            ShippingQuotePort shippingQuotePort) {
        this.calculateCheckoutUseCase = calculateCheckoutUseCase;
        this.shippingQuotePort = shippingQuotePort;
    }

    @PostMapping("/calculate")
    public ApiResponse<CheckoutBreakdownResponse> calculate(@Valid @RequestBody CalculateCheckoutRequest request) {
        // userId pulled from the JWT — anonymous /calculate calls (no auth)
        // resolve to null and the validator skips per-user usage checks.
        // The wire shape's couponCode is the buyer's proposal; the BE
        // resolves the actual discount via CouponValidator so the FE
        // never gets to set a discount amount.
        String userId = safeCurrentUserId();
        CalculateCheckoutUseCase.CheckoutBreakdown breakdown =
                calculateCheckoutUseCase.calculate(request.toLineItems(), request.couponCode(), userId);

        return ApiResponse.ok(CheckoutBreakdownResponse.fromApplication(breakdown));
    }

    /**
     * Cart-based checkout preview. Fetches the authenticated buyer's active
     * cart from cart-service (via {@link com.vnshop.orderservice.domain.port.out.CartRepositoryPort})
     * and returns the same {@link CheckoutBreakdownResponse} shape as
     * {@code POST /checkout/calculate}.
     *
     * <p>Authentication is required — the cart is keyed by userId, so an
     * anonymous caller has no cart to fetch. Use {@code POST /checkout/calculate}
     * for unauthenticated "buy now" previews.
     */
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/calculate-from-cart")
    public ApiResponse<CheckoutBreakdownResponse> calculateFromCart() {
        // Cart-service identifies carts by x-user-id header, so userId IS the cart key.
        String userId = JwtPrincipalUtil.currentUserId();
        CalculateCheckoutUseCase.CheckoutBreakdown breakdown =
                calculateCheckoutUseCase.calculate(userId);
        return ApiResponse.ok(CheckoutBreakdownResponse.fromApplication(breakdown));
    }

    private static String safeCurrentUserId() {
        try {
            return JwtPrincipalUtil.currentUserId();
        } catch (RuntimeException ignored) {
            // Anonymous /calculate calls (preview before login) — return null
            // so per-user usage caps don't apply. Authoritative validation
            // still runs on /checkout/apply-coupon at place-order time.
            return null;
        }
    }

    @GetMapping("/payment-methods")
    public ApiResponse<List<PaymentMethodResponse>> paymentMethods() {
        List<PaymentMethodResponse> methods = new java.util.ArrayList<>();
        methods.add(new PaymentMethodResponse(
                "COD",
                "Cash on Delivery",
                "Pay with cash when the order is delivered",
                codEnabled));
        methods.add(new PaymentMethodResponse(
                "VIETQR",
                "VietQR",
                "Pay by scanning a VietQR bank-transfer code",
                vietqrEnabled));
        methods.add(new PaymentMethodResponse(
                "VNPAY",
                "VNPay",
                "Pay online via VNPay (ATM, QR, internet banking)",
                deferredGatewayAEnabled));
        methods.add(new PaymentMethodResponse(
                "MOMO",
                "MoMo",
                "Pay with the MoMo e-wallet",
                deferredGatewayBEnabled));
        return ApiResponse.ok(java.util.Collections.unmodifiableList(methods));
    }

    @PostMapping("/shipping-options")
    public ApiResponse<List<ShippingOptionResponse>> shippingOptions(@Valid @RequestBody ShippingOptionsRequest request) {
        ShippingQuoteResult result = shippingQuotePort.quote(toQuoteRequest(request));
        return switch (result) {
            case ShippingQuoteResult.Success success -> ApiResponse.ok(success.options().stream()
                    .map(o -> new ShippingOptionResponse(o.method(), o.cost(), o.estimate()))
                    .toList());
            case ShippingQuoteResult.NoOptions ignored -> ApiResponse.ok(List.of());
            case ShippingQuoteResult.DependencyUnavailable unavailable -> throw new ShippingException(
                    "SHIPPING_QUOTE_UNAVAILABLE", unavailable.reason(), null);
            case ShippingQuoteResult.InvalidParcelMetadata invalid -> throw new IllegalArgumentException(
                    invalid.reason());
        };
    }

    private static ShippingQuoteRequest toQuoteRequest(ShippingOptionsRequest request) {
        AddressRequest addr = request.address();
        return new ShippingQuoteRequest(addr.street(), addr.ward(), addr.district(), addr.city(), request.parcel().toDomain());
    }
}
