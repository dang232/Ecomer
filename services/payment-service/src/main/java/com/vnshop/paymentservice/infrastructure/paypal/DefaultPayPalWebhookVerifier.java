package com.vnshop.paymentservice.infrastructure.paypal;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import static com.vnshop.paymentservice.infrastructure.paypal.PayPalWebhookVerifier.PayPalWebhookVerificationResult.REJECTED;
import static com.vnshop.paymentservice.infrastructure.paypal.PayPalWebhookVerifier.PayPalWebhookVerificationResult.UNAVAILABLE;
import static com.vnshop.paymentservice.infrastructure.paypal.PayPalWebhookVerifier.PayPalWebhookVerificationResult.VERIFIED;

@Component
public class DefaultPayPalWebhookVerifier implements PayPalWebhookVerifier {
    private static final Logger log = LoggerFactory.getLogger(DefaultPayPalWebhookVerifier.class);
    private final PayPalProperties properties;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private volatile CachedToken cachedToken;

    @Autowired
    public DefaultPayPalWebhookVerifier(PayPalProperties properties, RestClient.Builder restClientBuilder,
                                        ObjectMapper objectMapper) {
        this(properties, restClientBuilder, objectMapper, Clock.systemUTC());
    }

    DefaultPayPalWebhookVerifier(PayPalProperties properties, RestClient.Builder restClientBuilder,
                                 ObjectMapper objectMapper, Clock clock) {
        this.properties = Objects.requireNonNull(properties, "properties is required");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
        this.restClient = Objects.requireNonNull(restClientBuilder, "restClientBuilder is required")
                .build();
    }

    @Override
    public PayPalWebhookVerificationResult verify(PayPalWebhookHeaders headers, String webhookId, String rawPayload) {
        if (headers == null || !headers.complete() || webhookId == null || webhookId.isBlank()) {
            return REJECTED;
        }
        try {
            String body = verificationRequest(headers, webhookId, rawPayload);

            Map<?, ?> response = restClient.post()
                    .uri(properties.baseUrl() + "/v1/notifications/verify-webhook-signature")
                    .header(HttpHeaders.AUTHORIZATION, bearer())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            return response != null && "SUCCESS".equals(response.get("verification_status"))
                    ? VERIFIED : REJECTED;
        } catch (RestClientResponseException ex) {
            log.warn("paypal-webhook-verification-unavailable type={}", ex.getClass().getSimpleName());
            return UNAVAILABLE;
        } catch (RuntimeException ex) {
            log.warn("paypal-webhook-verification-unavailable type={}", ex.getClass().getSimpleName());
            return UNAVAILABLE;
        }
    }

    private String verificationRequest(PayPalWebhookHeaders headers, String webhookId, String rawPayload) {
        if (rawPayload == null || rawPayload.isBlank()) {
            return "";
        }
        try {
            objectMapper.readTree(rawPayload);
            Map<String, String> fields = new LinkedHashMap<>();
            fields.put("auth_algo", headers.authAlgo());
            fields.put("cert_url", headers.certUrl());
            fields.put("transmission_id", headers.transmissionId());
            fields.put("transmission_sig", headers.transmissionSig());
            fields.put("transmission_time", headers.transmissionTime());
            fields.put("webhook_id", webhookId);
            StringBuilder body = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<String, String> field : fields.entrySet()) {
                if (!first) body.append(',');
                body.append(objectMapper.writeValueAsString(field.getKey()))
                        .append(':')
                        .append(objectMapper.writeValueAsString(field.getValue()));
                first = false;
            }
            return body.append(",\"webhook_event\":").append(rawPayload).append('}').toString();
        } catch (Exception ex) {
            throw new IllegalArgumentException("PayPal webhook payload is not valid JSON", ex);
        }
    }

    private synchronized String bearer() {
        Instant now = Instant.now(clock);
        if (cachedToken != null && now.isBefore(cachedToken.expiresAt())) {
            return cachedToken.value();
        }

        String credentials = Base64.getEncoder().encodeToString(
                (properties.clientId() + ":" + properties.clientSecret()).getBytes(StandardCharsets.UTF_8));
        Map<?, ?> response = restClient.post()
                .uri(properties.baseUrl() + "/v1/oauth2/token")
                .header(HttpHeaders.AUTHORIZATION, "Basic " + credentials)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body("grant_type=client_credentials")
                .retrieve()
                .body(Map.class);
        if (response == null || response.get("access_token") == null) {
            throw new IllegalStateException("PayPal oauth token endpoint returned no access_token");
        }
        String value = "Bearer " + response.get("access_token");
        if (response.get("expires_in") instanceof Number expiresIn && expiresIn.longValue() > 0) {
            long safetyMarginSeconds = Math.min(30, Math.max(1, expiresIn.longValue() / 10));
            cachedToken = new CachedToken(value,
                    now.plus(Duration.ofSeconds(expiresIn.longValue() - safetyMarginSeconds)));
        } else {
            cachedToken = null;
        }
        return value;
    }

    private record CachedToken(String value, Instant expiresAt) {}
}
