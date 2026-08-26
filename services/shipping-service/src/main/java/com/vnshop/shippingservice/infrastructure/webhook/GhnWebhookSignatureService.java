package com.vnshop.shippingservice.infrastructure.webhook;

import com.vnshop.shippingservice.infrastructure.carrier.GhnProperties;
import com.vnshop.shippingservice.infrastructure.config.WebhookSecurityProperties;
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
public class GhnWebhookSignatureService {
    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final String PREFIX = "vnshop-ghn-webhook-v1";

    private final GhnProperties properties;
    private final WebhookSecurityProperties securityProperties;
    private final Clock clock;

    @Autowired
    public GhnWebhookSignatureService(
            GhnProperties properties,
            WebhookSecurityProperties securityProperties,
            Environment environment) {
        this(properties, securityProperties, Clock.systemUTC());
    }

    GhnWebhookSignatureService(
            GhnProperties properties,
            WebhookSecurityProperties securityProperties,
            Clock clock) {
        this.properties = properties;
        this.securityProperties = securityProperties;
        this.clock = clock;
    }

    public GhnWebhookSignatureService(GhnProperties properties) {
        this(properties, new WebhookSecurityProperties(false), new StandardEnvironment());
    }

    public boolean isValid(GhnWebhookPayload payload, String signature, String ignoredToken) {
        String secret = properties.webhookSecret();
        if (payload == null || secret == null || secret.isBlank() || signature == null || signature.isBlank()) {
            return false;
        }
        try {
            Instant timestamp = Instant.parse(payload.updatedDate());
            long age = Math.abs(Duration.between(timestamp, clock.instant()).getSeconds());
            if (age > securityProperties.replayWindowSeconds()) {
                return false;
            }
            LinkedHashMap<String, String> fields = new LinkedHashMap<>();
            fields.put("order_code", payload.orderCode());
            fields.put("status", payload.status());
            fields.put("status_code", payload.statusCode());
            fields.put("updated_date", payload.updatedDate());
            fields.put("client_order_code", payload.clientOrderCode());
            fields.put("cod_collected_amount", payload.codCollectedAmount() == null
                    ? null : payload.codCollectedAmount().stripTrailingZeros().toPlainString());
            fields.put("collection_id", payload.collectionId());
            fields.put("currency", payload.currency());
            byte[] expected = hmac(WebhookCanonicalizer.serialize(PREFIX, fields), secret);
            return MessageDigest.isEqual(expected, Base64.getDecoder().decode(signature));
        } catch (DateTimeException | IllegalArgumentException exception) {
            return false;
        }
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
