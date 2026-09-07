package com.vnshop.paymentservice.infrastructure.paypal;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class DefaultPayPalWebhookVerifierTest {
    private static final PayPalWebhookHeaders HEADERS = new PayPalWebhookHeaders(
            "SHA256withRSA", "https://api-m.sandbox.paypal.com/cert", "tx-1", "sig-1", "2026-08-22T00:00:00Z");
    private static final String EVENT = "{ \"id\": \"evt-1\",\n\"event_type\": \"CUSTOMER.DISPUTE.CREATED\" }";

    @Test
    void postsPayPalVerificationContractAndRequiresSuccess() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        PayPalProperties properties = new PayPalProperties(true, "client-1", "secret-1", "sandbox");
        DefaultPayPalWebhookVerifier verifier = new DefaultPayPalWebhookVerifier(properties, builder, new ObjectMapper());

        server.expect(requestTo(properties.baseUrl() + "/v1/oauth2/token"))
                .andExpect(method(POST))
                .andRespond(withSuccess("{\"access_token\":\"AT-1\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(properties.baseUrl() + "/v1/notifications/verify-webhook-signature"))
                .andExpect(method(POST))
                .andExpect(content().string("{\"auth_algo\":\"SHA256withRSA\",\"cert_url\":\"https://api-m.sandbox.paypal.com/cert\",\"transmission_id\":\"tx-1\",\"transmission_sig\":\"sig-1\",\"transmission_time\":\"2026-08-22T00:00:00Z\",\"webhook_id\":\"webhook-1\",\"webhook_event\":" + EVENT + "}"))
                .andRespond(withSuccess("{\"verification_status\":\"SUCCESS\"}", MediaType.APPLICATION_JSON));

        assertThat(verifier.verify(HEADERS, "webhook-1", EVENT))
                .isEqualTo(PayPalWebhookVerifier.PayPalWebhookVerificationResult.VERIFIED);
        server.verify();
    }

    @Test
    void treatsProviderHttpFailureAsUnavailable() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        PayPalProperties properties = new PayPalProperties(true, "client-1", "secret-1", "sandbox");
        DefaultPayPalWebhookVerifier verifier = new DefaultPayPalWebhookVerifier(properties, builder, new ObjectMapper());

        server.expect(requestTo(properties.baseUrl() + "/v1/oauth2/token"))
                .andRespond(withBadRequest().body("{}"));

        assertThat(verifier.verify(HEADERS, "webhook-1", EVENT))
                .isEqualTo(PayPalWebhookVerifier.PayPalWebhookVerificationResult.UNAVAILABLE);
        server.verify();
    }

    @Test
    void reusesTokenUntilSafetyMarginAndRefreshesAfterExpiry() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        PayPalProperties properties = new PayPalProperties(true, "client-1", "secret-1", "sandbox");
        MutableClock clock = new MutableClock(Instant.parse("2026-08-22T00:00:00Z"));
        DefaultPayPalWebhookVerifier verifier = new DefaultPayPalWebhookVerifier(
                properties, builder, new ObjectMapper(), clock);

        server.expect(requestTo(properties.baseUrl() + "/v1/oauth2/token"))
                .andRespond(withSuccess("{\"access_token\":\"AT-1\",\"expires_in\":120}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(properties.baseUrl() + "/v1/notifications/verify-webhook-signature"))
                .andRespond(withSuccess("{\"verification_status\":\"SUCCESS\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(properties.baseUrl() + "/v1/notifications/verify-webhook-signature"))
                .andRespond(withSuccess("{\"verification_status\":\"SUCCESS\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(properties.baseUrl() + "/v1/oauth2/token"))
                .andRespond(withSuccess("{\"access_token\":\"AT-2\",\"expires_in\":120}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(properties.baseUrl() + "/v1/notifications/verify-webhook-signature"))
                .andRespond(withSuccess("{\"verification_status\":\"SUCCESS\"}", MediaType.APPLICATION_JSON));

        assertThat(verifier.verify(HEADERS, "webhook-1", EVENT)).isEqualTo(
                PayPalWebhookVerifier.PayPalWebhookVerificationResult.VERIFIED);
        clock.advanceSeconds(80);
        assertThat(verifier.verify(HEADERS, "webhook-2", EVENT)).isEqualTo(
                PayPalWebhookVerifier.PayPalWebhookVerificationResult.VERIFIED);

        clock.advanceSeconds(40);
        assertThat(verifier.verify(HEADERS, "webhook-3", EVENT)).isEqualTo(
                PayPalWebhookVerifier.PayPalWebhookVerificationResult.VERIFIED);
        server.verify();
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        private void advanceSeconds(long seconds) {
            instant = instant.plusSeconds(seconds);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
