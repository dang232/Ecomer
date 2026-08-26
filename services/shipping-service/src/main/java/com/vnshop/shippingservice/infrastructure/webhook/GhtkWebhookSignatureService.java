package com.vnshop.shippingservice.infrastructure.webhook;

import com.vnshop.shippingservice.infrastructure.carrier.GhtkProperties;
import com.vnshop.shippingservice.infrastructure.config.WebhookSecurityProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.DateTimeException;
import java.util.Base64;
import java.util.LinkedHashMap;

@Component
public class GhtkWebhookSignatureService {
    private static final Logger LOG = LoggerFactory.getLogger(GhtkWebhookSignatureService.class);
    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final String PREFIX = "vnshop-ghtk-webhook-v1";

    private final GhtkProperties properties;
    private final WebhookSecurityProperties securityProperties;
    private final Clock clock;

    @Autowired
    public GhtkWebhookSignatureService(
            GhtkProperties properties,
            WebhookSecurityProperties securityProperties,
            Environment environment) {
        this(properties, securityProperties, Clock.systemUTC());
    }

    GhtkWebhookSignatureService(
            GhtkProperties properties,
            WebhookSecurityProperties securityProperties,
            Clock clock) {
        this.properties = properties;
        this.securityProperties = securityProperties;
        this.clock = clock;
    }

    public GhtkWebhookSignatureService(GhtkProperties properties) {
        this(properties, new WebhookSecurityProperties(false), new StandardEnvironment());
    }

    public boolean isValid(GhtkWebhookPayload payload, String signature) {
        String secret = properties.webhookSecret();
        if (payload == null || secret == null || secret.isBlank()) {
            LOG.error("GHTK webhook secret is not configured or payload is missing");
            return false;
        }
        if (signature == null || signature.isBlank()) {
            LOG.warn("GHTK webhook signature is missing");
            return false;
        }

        try {
            Instant timestamp = Instant.parse(payload.updatedAt());
            long age = Math.abs(Duration.between(timestamp, clock.instant()).getSeconds());
            if (age > securityProperties.replayWindowSeconds()) {
                LOG.warn("GHTK webhook timestamp is outside replay window");
                return false;
            }
            byte[] supplied = Base64.getDecoder().decode(signature);
            byte[] expected = hmac(canonical(payload), secret);
            return MessageDigest.isEqual(expected, supplied);
        } catch (DateTimeException | IllegalArgumentException exception) {
            LOG.warn("Malformed GHTK webhook signature or timestamp");
            return false;
        }
    }

    private String canonical(GhtkWebhookPayload payload) {
        LinkedHashMap<String, String> fields = new LinkedHashMap<>();
        fields.put("label_id", payload.labelId());
        fields.put("status", payload.status());
        fields.put("status_text", payload.statusText());
        fields.put("updated_at", Instant.parse(payload.updatedAt()).toString());
        fields.put("order_id", payload.orderId());
        fields.put("cod_collected_amount", payload.codCollectedAmount() == null
                ? null : payload.codCollectedAmount().stripTrailingZeros().toPlainString());
        fields.put("collection_id", payload.collectionId());
        fields.put("currency", payload.currency());
        return WebhookCanonicalizer.serialize(PREFIX, fields);
    }

    private static byte[] hmac(String value, String secret) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("Failed to compute webhook signature", exception);
        }
    }
}
