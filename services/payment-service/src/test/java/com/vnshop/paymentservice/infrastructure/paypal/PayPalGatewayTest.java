package com.vnshop.paymentservice.infrastructure.paypal;

import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.FxRatePort;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Verifies the PayPal v2 Checkout REST contract. Each call requires an OAuth
 * bearer minted from {@code /v1/oauth2/token}, so the create + capture tests
 * each expect two round-trips against {@link MockRestServiceServer}.
 */
class PayPalGatewayTest {

    @Test
    void rejectsBlankClientIdAtConstruction() {
        PayPalProperties props = new PayPalProperties(true, "", "secret-1", "sandbox");
        assertThatThrownBy(() -> new PayPalGateway(props, fixedFxRate(), RestClient.builder()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("client id");
    }

    @Test
    void rejectsBlankClientSecretAtConstruction() {
        PayPalProperties props = new PayPalProperties(true, "client-1", "", "sandbox");
        assertThatThrownBy(() -> new PayPalGateway(props, fixedFxRate(), RestClient.builder()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("client secret");
    }

    @Test
    void createOrderBuildsCaptureIntentWithUsdAmountAndPaymentIdMetadata() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        PayPalProperties props = sandboxProps();
        PayPalGateway gateway = new PayPalGateway(props, fixedFxRate(), builder);

        // OAuth token endpoint — basic auth from clientId:clientSecret
        server.expect(requestTo(props.baseUrl() + "/v1/oauth2/token"))
                .andExpect(method(POST))
                .andExpect(header("Authorization", basic("client-1", "secret-1")))
                .andRespond(withSuccess("{\"access_token\":\"AT-1\",\"token_type\":\"Bearer\"}", MediaType.APPLICATION_JSON));

        // Order creation — body must carry the converted USD amount + paymentId
        server.expect(requestTo(props.baseUrl() + "/v2/checkout/orders"))
                .andExpect(method(POST))
                .andExpect(header("Authorization", "Bearer AT-1"))
                .andExpect(header("PayPal-Request-Id", "create:paypal:" + paymentId()))
                .andExpect(jsonPath("$.intent").value("CAPTURE"))
                .andExpect(jsonPath("$.purchase_units[0].reference_id").value(paymentId().toString()))
                .andExpect(jsonPath("$.purchase_units[0].custom_id").value(paymentId().toString()))
                .andExpect(jsonPath("$.purchase_units[0].amount.currency_code").value("USD"))
                .andExpect(jsonPath("$.purchase_units[0].amount.value").value("4.00"))
                .andRespond(withSuccess(
                        "{\"id\":\"ORDER-XYZ\",\"status\":\"CREATED\"}",
                        MediaType.APPLICATION_JSON));

        PayPalGateway.PayPalOrder order = gateway.createOrder(payment());

        assertThat(order.paypalOrderId()).isEqualTo("ORDER-XYZ");
        assertThat(order.status()).isEqualTo("CREATED");
        assertThat(order.externalAmount()).isEqualByComparingTo("4.00");
        assertThat(order.externalCurrency()).isEqualTo("USD");
        assertThat(order.fxRate()).isEqualByComparingTo("0.00004");
        server.verify();
    }

    @Test
    void captureExtractsCaptureIdFromNestedPurchaseUnits() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        PayPalProperties props = sandboxProps();
        PayPalGateway gateway = new PayPalGateway(props, fixedFxRate(), builder);

        server.expect(requestTo(props.baseUrl() + "/v1/oauth2/token"))
                .andRespond(withSuccess("{\"access_token\":\"AT-2\",\"token_type\":\"Bearer\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(props.baseUrl() + "/v2/checkout/orders/ORDER-XYZ/capture"))
                .andExpect(method(POST))
                .andExpect(header("Authorization", "Bearer AT-2"))
                .andExpect(header("PayPal-Request-Id", "capture:ORDER-XYZ"))
                .andExpect(header("Prefer", "return=representation"))
                .andRespond(withSuccess(
                        "{\"id\":\"ORDER-XYZ\",\"status\":\"COMPLETED\","
                                + "\"purchase_units\":[{\"payments\":{\"captures\":[{\"id\":\"CAPTURE-1\",\"status\":\"COMPLETED\"}]}}]}",
                        MediaType.APPLICATION_JSON));

        PayPalGateway.PayPalCapture capture = gateway.capture("ORDER-XYZ");

        assertThat(capture.paypalOrderId()).isEqualTo("ORDER-XYZ");
        assertThat(capture.captureId()).isEqualTo("CAPTURE-1");
        assertThat(capture.status()).isEqualTo("COMPLETED");
        server.verify();
    }

    @Test
    void createOrderSurfacesUpstream4xxAsIllegalState() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        PayPalProperties props = sandboxProps();
        PayPalGateway gateway = new PayPalGateway(props, fixedFxRate(), builder);

        server.expect(requestTo(props.baseUrl() + "/v1/oauth2/token"))
                .andRespond(withSuccess("{\"access_token\":\"AT-3\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(props.baseUrl() + "/v2/checkout/orders"))
                .andRespond(withBadRequest().body("{\"name\":\"INVALID_REQUEST\"}").contentType(MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> gateway.createOrder(payment()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("PayPal order create failed");
    }

    @Test
    void captureLooksUpTheOrderWhenTheCaptureResponseIsMinimal() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        PayPalProperties props = sandboxProps();
        PayPalGateway gateway = new PayPalGateway(props, fixedFxRate(), builder);

        server.expect(requestTo(props.baseUrl() + "/v1/oauth2/token"))
                .andRespond(withSuccess("{\"access_token\":\"AT-4\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(props.baseUrl() + "/v2/checkout/orders/ORDER-FALLBACK/capture"))
                .andRespond(withSuccess(
                        "{\"id\":\"ORDER-FALLBACK\",\"status\":\"COMPLETED\"}",
                        MediaType.APPLICATION_JSON));
        server.expect(requestTo(props.baseUrl() + "/v1/oauth2/token"))
                .andRespond(withSuccess("{\"access_token\":\"AT-4B\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(props.baseUrl() + "/v2/checkout/orders/ORDER-FALLBACK"))
                .andExpect(header("Authorization", "Bearer AT-4B"))
                .andRespond(withSuccess(
                        "{\"id\":\"ORDER-FALLBACK\",\"status\":\"COMPLETED\","
                                + "\"purchase_units\":[{\"payments\":{\"captures\":[{\"id\":\"CAPTURE-FALLBACK\",\"status\":\"COMPLETED\"}]}}]}",
                        MediaType.APPLICATION_JSON));

        PayPalGateway.PayPalCapture capture = gateway.capture("ORDER-FALLBACK");

        assertThat(capture.paypalOrderId()).isEqualTo("ORDER-FALLBACK");
        assertThat(capture.captureId()).isEqualTo("CAPTURE-FALLBACK");
        assertThat(capture.status()).isEqualTo("COMPLETED");
        server.verify();
    }

    @Test
    void refundPostsCaptureRefundWithUsdAmountAndRequestIdHeader() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        PayPalProperties props = sandboxProps();
        PayPalGateway gateway = new PayPalGateway(props, fixedFxRate(), builder);

        server.expect(requestTo(props.baseUrl() + "/v1/oauth2/token"))
                .andRespond(withSuccess("{\"access_token\":\"AT-5\",\"token_type\":\"Bearer\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(props.baseUrl() + "/v2/payments/captures/CAPTURE-1/refund"))
                .andExpect(method(POST))
                .andExpect(header("Authorization", "Bearer AT-5"))
                .andExpect(header("PayPal-Request-Id", "RETURN-42"))
                .andExpect(jsonPath("$.amount.currency_code").value("USD"))
                .andExpect(jsonPath("$.amount.value").value("4.00"))
                .andRespond(withSuccess(
                        "{\"id\":\"REFUND-1\",\"status\":\"COMPLETED\"}",
                        MediaType.APPLICATION_JSON));

        PayPalGateway.PayPalRefund refund = gateway.refund("CAPTURE-1", new BigDecimal("4.00"), "RETURN-42");

        assertThat(refund.refundId()).isEqualTo("REFUND-1");
        assertThat(refund.captureId()).isEqualTo("CAPTURE-1");
        assertThat(refund.status()).isEqualTo("COMPLETED");
        server.verify();
    }

    @Test
    void refundSurfacesUpstream4xxAsIllegalState() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        PayPalProperties props = sandboxProps();
        PayPalGateway gateway = new PayPalGateway(props, fixedFxRate(), builder);

        server.expect(requestTo(props.baseUrl() + "/v1/oauth2/token"))
                .andRespond(withSuccess("{\"access_token\":\"AT-6\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(props.baseUrl() + "/v2/payments/captures/CAPTURE-2/refund"))
                .andRespond(withBadRequest()
                        .body("{\"name\":\"INVALID_REQUEST\"}")
                        .contentType(MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> gateway.refund("CAPTURE-2", new BigDecimal("4.00"), "RETURN-43"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("PayPal refund failed");
    }

    private static PayPalProperties sandboxProps() {
        return new PayPalProperties(true, "client-1", "secret-1", "sandbox");
    }

    private static FxRatePort fixedFxRate() {
        return (from, to) -> new BigDecimal("0.00004");
    }

    private static Payment payment() {
        return new Payment(paymentId(), "ORDER-1", "BUYER-1",
                new BigDecimal("100000"), PaymentMethod.PAYPAL, PaymentStatus.PENDING, null,
                Instant.parse("2026-05-19T00:00:00Z"));
    }

    private static UUID paymentId() {
        return UUID.fromString("00000000-0000-0000-0000-000000000777");
    }

    private static String basic(String user, String pass) {
        return "Basic " + java.util.Base64.getEncoder().encodeToString(
                (user + ":" + pass).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
