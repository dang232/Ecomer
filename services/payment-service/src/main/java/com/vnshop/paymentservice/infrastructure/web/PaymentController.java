package com.vnshop.paymentservice.infrastructure.web;

import com.stripe.exception.StripeException;
import com.vnshop.paymentservice.application.GetPaymentStatusUseCase;
import com.vnshop.paymentservice.application.OrderAccessDeniedException;
import com.vnshop.paymentservice.application.PaymentMethodInput;
import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.application.ProcessPaymentCommand;
import com.vnshop.paymentservice.application.ProcessPaymentUseCase;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.infrastructure.config.JwtPrincipalUtil;
import com.vnshop.paymentservice.infrastructure.gateway.MomoCallbackService;
import com.vnshop.paymentservice.infrastructure.gateway.MomoIpnRequest;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackHasher;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
import com.vnshop.paymentservice.infrastructure.gateway.VietQrService;
import com.vnshop.paymentservice.infrastructure.gateway.VnpayCallbackService;
import com.vnshop.paymentservice.infrastructure.paypal.PayPalGateway;
import com.vnshop.paymentservice.infrastructure.stripe.StripeGateway;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/payment")
public class PaymentController {
    private static final String IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

    private final ProcessPaymentUseCase processPaymentUseCase;
    private final GetPaymentStatusUseCase getPaymentStatusUseCase;
    private final Optional<VnpayCallbackService> vnpayCallbackService;
    private final Optional<MomoCallbackService> momoCallbackService;
    private final Optional<VietQrService> vietQrService;
    private final Optional<StripeGateway> stripeGateway;
    private final Optional<PayPalGateway> payPalGateway;
    private final PaymentPromotionService promotionService;
    private final PaymentRepositoryPort paymentRepository;
    private final PaymentCallbackLogStore callbackLogStore;

    public PaymentController(
            ProcessPaymentUseCase processPaymentUseCase,
            GetPaymentStatusUseCase getPaymentStatusUseCase,
            Optional<VnpayCallbackService> vnpayCallbackService,
            Optional<MomoCallbackService> momoCallbackService,
            Optional<VietQrService> vietQrService,
            Optional<StripeGateway> stripeGateway,
            Optional<PayPalGateway> payPalGateway,
            PaymentPromotionService promotionService,
            PaymentRepositoryPort paymentRepository,
            PaymentCallbackLogStore callbackLogStore) {
        this.processPaymentUseCase = processPaymentUseCase;
        this.getPaymentStatusUseCase = getPaymentStatusUseCase;
        this.vnpayCallbackService = vnpayCallbackService;
        this.momoCallbackService = momoCallbackService;
        this.vietQrService = vietQrService;
        this.stripeGateway = stripeGateway;
        this.payPalGateway = payPalGateway;
        this.promotionService = promotionService;
        this.paymentRepository = paymentRepository;
        this.callbackLogStore = callbackLogStore;
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/cod/confirm")
    public ApiResponse<PaymentResponse> confirmCod(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody PaymentRequest request
    ) {
        return ApiResponse.ok(PaymentResponse.fromDomain(
                processOrReuse(request.orderId(), PaymentMethodInput.COD, idempotencyKey)));
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/vnpay/create")
    public ApiResponse<PaymentResponse> createVnpay(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody PaymentRequest request
    ) {
        return ApiResponse.ok(PaymentResponse.fromDomain(
                processOrReuse(request.orderId(), PaymentMethodInput.VNPAY, idempotencyKey)));
    }

    @GetMapping("/vnpay/ipn")
    public ApiResponse<VnpayIpnResponse> vnpayIpn(@RequestParam Map<String, String> parameters, @RequestHeader Map<String, String> headers) {
        VnpayCallbackService.VnpayIpnResult result = requireVnpayCallbackService().handleIpn(parameters, headers);
        return ApiResponse.ok(new VnpayIpnResponse(result.responseCode(), result.message()));
    }

    @GetMapping("/vnpay/return")
    public ApiResponse<VnpayReturnResponse> vnpayReturn(@RequestParam Map<String, String> parameters) {
        var verification = requireVnpayCallbackService().verifyReturn(parameters);
        return ApiResponse.ok(new VnpayReturnResponse(verification.validSignature(), verification.status().name(), verification.paymentId(), verification.transactionNo()));
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/momo/create")
    public ApiResponse<PaymentResponse> createMomo(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody PaymentRequest request
    ) {
        return ApiResponse.ok(PaymentResponse.fromDomain(
                processOrReuse(request.orderId(), PaymentMethodInput.MOMO, idempotencyKey)));
    }

    @PostMapping("/momo/ipn")
    public ApiResponse<MomoIpnResponse> momoIpn(@RequestBody MomoIpnRequest request, @RequestHeader Map<String, String> headers) {
        MomoCallbackService.MomoIpnResult result = requireMomoCallbackService().handleIpn(request, headers);
        return ApiResponse.ok(new MomoIpnResponse(result.resultCode(), result.message()));
    }

    /**
     * VietQR create flow. Creates a PENDING payment via the standard pipeline
     * and returns a vietqr.io QR image URL the FE renders for the buyer to
     * scan. Confirmation arrives manually via the admin endpoint
     * {@code POST /admin/vietqr/confirm/{paymentId}} (lives on
     * {@link AdminVietQrController} so the gateway's /admin/vietqr/** route
     * resolves cleanly without colliding with the /payment class prefix).
     */
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/vietqr/create")
    public ApiResponse<VietQrCreateResponse> createVietQr(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody PaymentRequest request
    ) {
        VietQrService qrService = vietQrService.orElseThrow(() ->
                new IllegalStateException("VietQR is not enabled — set payment.vietqr.enabled=true"));
        Payment payment = processOrReuse(request.orderId(), PaymentMethodInput.VIETQR, idempotencyKey);
        VietQrService.VietQrPayment qr = qrService.generate(
                payment.paymentId().toString(), payment.amount());
        return ApiResponse.ok(new VietQrCreateResponse(
                PaymentResponse.fromDomain(payment),
                qr.qrImageUrl(),
                qr.bankBin(),
                qr.accountNo(),
                qr.accountName(),
                qr.reference()));
    }

    /**
     * PayPal create flow. Persists a PENDING payment via the standard pipeline,
     * builds a {@code CAPTURE}-intent order on PayPal, and returns the order id
     * the FE Smart Buttons need. Capture is initiated separately at
     * {@code POST /payment/paypal/capture/{paypalOrderId}} so the FE flow stays
     * synchronous (no webhook needed for sandbox).
     */
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/paypal/create")
    public ApiResponse<PayPalCreateResponse> createPayPal(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody PaymentRequest request
    ) {
        PayPalGateway gateway = payPalGateway.orElseThrow(() ->
                new IllegalStateException("PayPal is not enabled — set payment.paypal.enabled=true"));
        Payment payment = processPaymentUseCase.process(new ProcessPaymentCommand(
                request.orderId(), JwtPrincipalUtil.currentUserId(),
                PaymentMethodInput.PAYPAL, idempotencyKey));
        PayPalGateway.PayPalOrder order = gateway.createOrder(payment);
        // Persist PayPal order ID as transactionRef so the capture endpoint can
        // verify the client-supplied paypalOrderId matches what was created.
        Payment withRef = payment.withResult(payment.status(), order.paypalOrderId());
        // Persist FX details so they survive for dispute support / audit.
        Payment enriched = withRef.withFxDetails(
                order.externalAmount(), order.externalCurrency(), order.fxRate(), Instant.now());
        paymentRepository.save(enriched);
        return ApiResponse.ok(PayPalCreateResponse.of(
                enriched,
                gateway.properties().clientId(),
                order.paypalOrderId(),
                order.status(),
                order.externalAmount(),
                order.externalCurrency(),
                order.fxRate()));
    }

    /**
     * PayPal capture endpoint. The FE calls this from {@code onApprove} once
     * the buyer authorises in the Smart Buttons popup. Capture commits via
     * {@link PaymentPromotionService} synchronously — no FE polling needed,
     * the response IS the confirmation.
     *
     * <p>The FE already has both {@code paymentId} (from {@code /paypal/create})
     * and {@code paypalOrderId} (from PayPal's {@code onApprove} callback), so
     * it passes both back here. Resolving the internal id from PayPal's order
     * metadata is technically possible but would need a {@code findByExternalRef}
     * query — not worth adding for a path the FE already knows.
     */
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/paypal/capture/{paymentId}/{paypalOrderId}")
    public ApiResponse<PaymentResponse> capturePayPal(
            @PathVariable String paymentId,
            @PathVariable String paypalOrderId) {
        PayPalGateway gateway = payPalGateway.orElseThrow(() ->
                new IllegalStateException("PayPal is not enabled — set payment.paypal.enabled=true"));
        java.util.UUID id = java.util.UUID.fromString(paymentId);
        // Pt39 audit (extends pt37/pt38): the prior code raised three
        // distinct error bodies — IAE("payment not found"), IAE("payment is
        // not PayPal"), OAD("buyer X does not own payment Y") — letting a
        // malicious caller distinguish "doesn't exist" from "exists but wrong
        // method" from "exists, right method, not yours". All three are
        // "you can't act on this," so collapse into one OAD with a constant
        // message. Auth check still happens after the lookup (need the
        // payment row to know the buyer), but the response body is now
        // identical regardless of which branch tripped.
        String caller = JwtPrincipalUtil.currentUserId();
        Payment existing = paymentRepository.findById(id)
                .orElseThrow(() -> new com.vnshop.paymentservice.application.OrderAccessDeniedException(
                        "not authorized to capture this payment"));
        if (existing.method() != com.vnshop.paymentservice.domain.PaymentMethod.PAYPAL
                || !existing.buyerId().equals(caller)) {
            throw new com.vnshop.paymentservice.application.OrderAccessDeniedException(
                    "not authorized to capture this payment");
        }
        // Verify the client-supplied paypalOrderId matches the one stored at
        // creation time. Prevents a buyer from capturing a cheap PayPal order
        // against an expensive internal payment record.
        if (existing.transactionRef() == null || !existing.transactionRef().equals(paypalOrderId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "PayPal order ID mismatch");
        }
        // Dedup keyed off paypalOrderId via PaymentCallbackLogStore — matches
        // the Stripe webhook pattern. A double-tap from the FE (refresh,
        // retry, network blip) finds the prior PROCESSED attempt and skips
        // the capture API call entirely; the current payment row is returned
        // unchanged. PaymentPromotionService still short-circuits ALREADY_COMPLETED
        // on its own, so this is a defensive layer that prevents the second
        // PayPal API call and the cosmetic duplicate outbox row.
        String dedupPayloadHash = PaymentCallbackHasher.sha256(paypalOrderId);
        var duplicate = callbackLogStore.findProcessed("PAYPAL", paypalOrderId, dedupPayloadHash, "").orElse(null);
        if (duplicate != null) {
            callbackLogStore.save(payPalAttempt(paypalOrderId, dedupPayloadHash, duplicate.processingStatus(), true));
            return ApiResponse.ok(PaymentResponse.fromDomain(existing));
        }
        PayPalGateway.PayPalCapture capture = gateway.capture(paypalOrderId);
        PaymentCallbackAttempt savedAttempt = callbackLogStore.save(
                payPalAttempt(paypalOrderId, dedupPayloadHash, "PROCESSED", false));
        PaymentPromotionService.PromotionResult result = promotionService.promote(
                PaymentPromotionService.PromotionCommand.fromCallback(
                        id, "PAYPAL", capture.captureId(),
                        savedAttempt.callbackId(), capture.captureId(), dedupPayloadHash));
        return ApiResponse.ok(PaymentResponse.fromDomain(result.payment()));
    }

    private PaymentCallbackAttempt payPalAttempt(String paypalOrderId, String payloadHash,
                                                  String processingStatus, boolean duplicateReplay) {
        return new PaymentCallbackAttempt(
                UUID.randomUUID(),
                "PAYPAL",
                paypalOrderId,
                payloadHash,
                "",
                "",
                paypalOrderId,
                Instant.now(),
                processingStatus,
                duplicateReplay);
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/status/{orderId}")
    public ApiResponse<PaymentResponse> status(@PathVariable String orderId) {
        // Pt13 follow-up IDOR fix: any authenticated buyer could probe
        // arbitrary orderIds and read another buyer's payment status. The
        // buyer-aware variant cross-checks against the JWT principal. The
        // unauthenticated/gRPC variant lives on getByOrderId(orderId) for
        // trusted callers (order-service polling, etc.).
        return ApiResponse.ok(PaymentResponse.fromDomain(
                getPaymentStatusUseCase.getByOrderIdForBuyer(orderId, JwtPrincipalUtil.currentUserId())));
    }

    /**
     * Stripe create flow. Persists a PENDING payment via the standard pipeline
     * and returns a Stripe {@code clientSecret} the FE Elements provider mounts
     * to render the embedded card form. Webhook completion arrives separately
     * at {@code POST /payment/stripe/webhook}.
     */
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/stripe/create")
    public ApiResponse<StripeCreateResponse> createStripe(
            @RequestHeader(name = IDEMPOTENCY_KEY_HEADER, required = false) String idempotencyKey,
            @Valid @RequestBody PaymentRequest request
    ) throws StripeException {
        StripeGateway gateway = stripeGateway.orElseThrow(() ->
                new IllegalStateException("Stripe is not enabled — set payment.stripe.enabled=true"));
        Payment payment = processPaymentUseCase.process(new ProcessPaymentCommand(
                request.orderId(), JwtPrincipalUtil.currentUserId(),
                PaymentMethodInput.STRIPE, idempotencyKey));
        StripeGateway.StripeIntent intent = gateway.createPaymentIntent(payment);
        return ApiResponse.ok(StripeCreateResponse.of(
                payment,
                gateway.properties().publishableKey(),
                intent.clientSecret(),
                intent.intentId(),
                intent.externalAmount(),
                intent.externalCurrency(),
                intent.fxRate()));
    }

    private VnpayCallbackService requireVnpayCallbackService() {
        return vnpayCallbackService.orElseThrow(() -> new IllegalStateException("VNPay gateway is not enabled"));
    }

    private MomoCallbackService requireMomoCallbackService() {
        return momoCallbackService.orElseThrow(() -> new IllegalStateException("MoMo gateway is not enabled"));
    }

    /**
     * Order creation already runs the trusted payment step before persisting
     * the order. The buyer-facing confirmation call must return that payment
     * instead of charging the same order a second time.
     */
    private Payment processOrReuse(String orderId, PaymentMethodInput method, String idempotencyKey) {
        String buyerId = JwtPrincipalUtil.currentUserId();
        Optional<Payment> existing = paymentRepository.findByOrderId(orderId);
        if (existing.isPresent()) {
            Payment payment = existing.get();
            if (!buyerId.equals(payment.buyerId()) || !method.name().equals(payment.method().name())) {
                throw new OrderAccessDeniedException(
                        "not authorized to use this payment");
            }
            return payment;
        }
        return processPaymentUseCase.process(new ProcessPaymentCommand(orderId, buyerId, method, idempotencyKey));
    }
}
