package com.vnshop.paymentservice.infrastructure.paypal;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.port.out.FxRatePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Thin REST wrapper for PayPal's v2 Checkout API. Three operations:
 *
 * <ul>
 *   <li>{@link #createOrder} — POSTs {@code /v2/checkout/orders}, returns the
 *       order id the FE Smart Buttons need.</li>
 *   <li>{@link #capture} — POSTs {@code /v2/checkout/orders/{id}/capture} and
 *       returns the capture id for ledger reconciliation.</li>
 *   <li>{@link #refund} — POSTs {@code /v2/payments/captures/{id}/refund} so
 *       the saga compensation path on a return-completed event can issue the
 *       money-back call.</li>
 * </ul>
 *
 * <p>OAuth: PayPal's REST API uses client_credentials. We mint a bearer per
 * call (no caching) — sandbox traffic is light enough that the extra round-trip
 * isn't worth a TTL bookkeeping bug. Production-rotation is left for follow-up.
 *
 * <p>Bean is gated on {@code payment.paypal.enabled=true}.
 */
@Component
@ConditionalOnProperty(name = "payment.paypal.enabled", havingValue = "true")
public class PayPalGateway {
    private static final Logger log = LoggerFactory.getLogger(PayPalGateway.class);

    private final PayPalProperties properties;
    private final FxRatePort fxRatePort;
    private final RestClient restClient;

    public PayPalGateway(PayPalProperties properties, FxRatePort fxRatePort, RestClient.Builder restClientBuilder) {
        this.properties = Objects.requireNonNull(properties, "properties is required");
        this.fxRatePort = Objects.requireNonNull(fxRatePort, "fxRatePort is required");
        requireNonBlank(properties.clientId(), "PayPal client id is required");
        requireNonBlank(properties.clientSecret(), "PayPal client secret is required");
        this.restClient = Objects.requireNonNull(restClientBuilder, "restClientBuilder is required")
                .baseUrl(properties.baseUrl())
                .build();
    }

    public PayPalProperties properties() {
        return properties;
    }

    /**
     * Build a CAPTURE-intent order in USD. Order metadata stashes the internal
     * paymentId so the {@code /capture} endpoint can resolve it without an
     * extra round-trip.
     */
    public PayPalOrder createOrder(Payment payment) {
        return createOrder(payment, "create:paypal:" + payment.paymentId());
    }

    /** Uses the internal payment ID to derive a stable PayPal request identity. */
    public PayPalOrder createOrder(Payment payment, String providerCreateKey) {
        requireNonBlank(providerCreateKey, "PayPal provider create key is required");
        ExternalAmount external = externalAmount(payment);
        BigDecimal usdAmount = external.amount();
        BigDecimal rate = external.fxRate();

        Map<String, Object> body = Map.of(
                "intent", "CAPTURE",
                "purchase_units", List.of(Map.of(
                        "reference_id", payment.paymentId().toString(),
                        "custom_id", payment.paymentId().toString(),
                        "description", "Order " + payment.orderId(),
                        "amount", Map.of(
                                "currency_code", "USD",
                                "value", usdAmount.toPlainString()))));

        try {
            Map<?, ?> response = restClient.post()
                    .uri("/v2/checkout/orders")
                    .header(HttpHeaders.AUTHORIZATION, bearer())
                    .header("PayPal-Request-Id", providerCreateKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            if (response == null || response.get("id") == null) {
                throw new IllegalStateException("PayPal returned empty response");
            }
            return new PayPalOrder(
                    response.get("id").toString(),
                    response.get("status") != null ? response.get("status").toString() : "CREATED",
                    usdAmount,
                    "USD",
                    rate);
        } catch (RestClientResponseException ex) {
            log.warn("paypal-order-create-failed status={} body={}", ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new IllegalStateException("PayPal order create failed: " + ex.getStatusCode(), ex);
        }
    }

    /**
     * Capture an approved order. Returns the capture id (the per-payment
     * ledger reference). Idempotent on PayPal's side — calling twice returns
     * the same capture record on the second attempt.
     */
    public PayPalCapture capture(String paypalOrderId) {
        return capture(paypalOrderId, "capture:" + paypalOrderId);
    }

    /** Captures with a stable server-derived request ID and representation response preference. */
    public PayPalCapture capture(String paypalOrderId, String captureRequestId) {
        requireNonBlank(captureRequestId, "PayPal capture request key is required");
        try {
            Map<?, ?> response = restClient.post()
                    .uri("/v2/checkout/orders/{id}/capture", paypalOrderId)
                    .header(HttpHeaders.AUTHORIZATION, bearer())
                    .header("PayPal-Request-Id", captureRequestId)
                    .header("Prefer", "return=representation")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of())
                    .retrieve()
                    .body(Map.class);
            return PayPalCapture.fromResponse(paypalOrderId, response)
                    .orElseGet(() -> PayPalCapture.fromResponse(paypalOrderId, showOrder(paypalOrderId))
                            .orElseThrow(() -> new IllegalStateException(
                                    "PayPal capture response did not contain one completed capture")));
        } catch (RestClientResponseException ex) {
            HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
            log.warn("paypal-capture-failed paypalOrderId={} status={} body={}",
                    paypalOrderId, status, ex.getResponseBodyAsString());
            throw new IllegalStateException("PayPal capture failed: " + ex.getStatusCode(), ex);
        }
    }

    private Map<?, ?> showOrder(String paypalOrderId) {
        Map<?, ?> response = restClient.get()
                .uri("/v2/checkout/orders/{id}", paypalOrderId)
                .header(HttpHeaders.AUTHORIZATION, bearer())
                .retrieve()
                .body(Map.class);
        if (response == null) {
            throw new IllegalStateException("PayPal order lookup returned empty body");
        }
        return response;
    }

    private ExternalAmount externalAmount(Payment payment) {
        if (payment.externalAmount() != null
                && payment.externalCurrency() != null
                && payment.fxRate() != null) {
            if (!"USD".equalsIgnoreCase(payment.externalCurrency())) {
                throw new IllegalArgumentException("PayPal external currency must be USD");
            }
            return new ExternalAmount(payment.externalAmount(), payment.fxRate());
        }
        BigDecimal rate = fxRatePort.rate("VND", "USD");
        return new ExternalAmount(payment.amount().multiply(rate).setScale(2, RoundingMode.HALF_UP), rate);
    }

    /**
     * Refund a previously-captured payment. Sandbox returns the refund record
     * synchronously; no webhook is required. Idempotent on PayPal's side via
     * the {@code PayPal-Request-Id} header — supplying the same id twice
     * returns the same refund record without issuing money twice.
     *
     * @param captureId  the capture id PayPal returned from {@link #capture}
     * @param usdAmount  amount to refund in USD; converted upstream from VND
     * @param requestId  caller-supplied idempotency key (we use the returnId
     *                   from the saga so retries collapse on PayPal's side)
     */
    public PayPalRefund refund(String captureId, BigDecimal usdAmount, String requestId) {
        Objects.requireNonNull(captureId, "captureId is required");
        Objects.requireNonNull(usdAmount, "usdAmount is required");
        Objects.requireNonNull(requestId, "requestId is required");

        Map<String, Object> body = Map.of(
                "amount", Map.of(
                        "currency_code", "USD",
                        "value", usdAmount.setScale(2, RoundingMode.HALF_UP).toPlainString()));
        try {
            Map<?, ?> response = restClient.post()
                    .uri("/v2/payments/captures/{id}/refund", captureId)
                    .header(HttpHeaders.AUTHORIZATION, bearer())
                    .header("PayPal-Request-Id", requestId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            if (response == null) {
                throw new IllegalStateException("PayPal refund returned empty body");
            }
            String refundId = response.get("id") != null ? response.get("id").toString() : "UNKNOWN";
            String status = response.get("status") != null ? response.get("status").toString() : "UNKNOWN";
            return new PayPalRefund(refundId, captureId, status);
        } catch (RestClientResponseException ex) {
            log.warn("paypal-refund-failed captureId={} status={} body={}",
                    captureId, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new IllegalStateException("PayPal refund failed: " + ex.getStatusCode(), ex);
        }
    }

    private String bearer() {
        String credentials = Base64.getEncoder().encodeToString(
                (properties.clientId() + ":" + properties.clientSecret())
                        .getBytes(StandardCharsets.UTF_8));
        Map<?, ?> response = restClient.post()
                .uri("/v1/oauth2/token")
                .header(HttpHeaders.AUTHORIZATION, "Basic " + credentials)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body("grant_type=client_credentials")
                .retrieve()
                .body(Map.class);
        if (response == null || response.get("access_token") == null) {
            throw new IllegalStateException("PayPal oauth token endpoint returned no access_token");
        }
        return "Bearer " + response.get("access_token");
    }

    private static void requireNonBlank(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
    }

    public record PayPalOrder(
            String paypalOrderId,
            String status,
            BigDecimal externalAmount,
            String externalCurrency,
            BigDecimal fxRate) {
    }

    public record PayPalCapture(
            String paypalOrderId,
            String captureId,
            String status) {
        public static java.util.Optional<PayPalCapture> fromResponse(String paypalOrderId, Map<?, ?> response) {
            if (response == null) {
                throw new IllegalStateException("PayPal capture returned empty body");
            }
            java.util.List<Map<?, ?>> completedCaptures = extractCompletedCaptures(response);
            if (completedCaptures.isEmpty()) {
                return java.util.Optional.empty();
            }
            if (completedCaptures.size() != 1) {
                throw new IllegalStateException("PayPal response contains ambiguous completed captures");
            }
            Map<?, ?> capture = completedCaptures.get(0);
            Object captureId = capture.get("id");
            if (captureId == null || captureId.toString().isBlank()) {
                throw new IllegalStateException("PayPal completed capture has no capture ID");
            }
            return java.util.Optional.of(new PayPalCapture(paypalOrderId, captureId.toString(), "COMPLETED"));
        }

        private static java.util.List<Map<?, ?>> extractCompletedCaptures(Map<?, ?> response) {
            java.util.List<Map<?, ?>> completed = new java.util.ArrayList<>();
            Object purchaseUnits = response.get("purchase_units");
            if (purchaseUnits instanceof List<?> units) {
                for (Object unit : units) {
                    if (unit instanceof Map<?, ?> unitMap && unitMap.get("payments") instanceof Map<?, ?> payments) {
                        Object captures = payments.get("captures");
                        if (captures instanceof List<?> captureList) {
                            for (Object capture : captureList) {
                                if (capture instanceof Map<?, ?> captureMap
                                        && "COMPLETED".equals(String.valueOf(captureMap.get("status")))) {
                                    completed.add(captureMap);
                                }
                            }
                        }
                    }
                }
            }
            return completed;
        }
    }

    public record PayPalRefund(
            String refundId,
            String captureId,
            String status) {
    }

    private record ExternalAmount(BigDecimal amount, BigDecimal fxRate) {
    }
}
