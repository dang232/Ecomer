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
import java.util.HexFormat;

/**
 * Service to verify GHTK webhook signatures.
 * GHTK uses HMAC-SHA256 for signature verification.
 */
@Component
public class GhtkWebhookSignatureService {
    private static final Logger LOG = LoggerFactory.getLogger(GhtkWebhookSignatureService.class);
    private static final String HMAC_SHA256 = "HmacSHA256";

    private final GhtkProperties properties;
    private final WebhookSecurityProperties webhookSecurityProperties;
    private final Environment environment;

    @Autowired
    public GhtkWebhookSignatureService(
            GhtkProperties properties,
            WebhookSecurityProperties webhookSecurityProperties,
            Environment environment) {
        this.properties = properties;
        this.webhookSecurityProperties = webhookSecurityProperties;
        this.environment = environment;
    }

    public GhtkWebhookSignatureService(GhtkProperties properties) {
        this(properties, new WebhookSecurityProperties(false), new StandardEnvironment());
    }

    /**
     * Validates the GHTK webhook signature.
     * Credentials are required unless the local-only opt-in is enabled in a local/dev profile.
     */
    public boolean isValid(GhtkWebhookPayload payload, String signature) {
        String configuredToken = properties.webhookToken();
        if (configuredToken == null || configuredToken.isBlank()) {
            if (isInsecureLocalMode()) {
                LOG.warn("Accepting GHTK webhook without credentials because explicit local-only opt-in is enabled");
                return true;
            }
            LOG.error("GHTK webhook token is not configured");
            return false;
        }

        if (signature == null || signature.isBlank()) {
            LOG.warn("GHTK webhook signature is missing");
            return false;
        }

        try {
            String expectedSignature = computeSignature(payload);
            byte[] supplied = HexFormat.of().parseHex(signature);
            boolean valid = MessageDigest.isEqual(
                    HexFormat.of().parseHex(expectedSignature), supplied);
            if (!valid) {
                LOG.warn("Invalid GHTK signature");
            }
            return valid;
        } catch (Exception e) {
            LOG.warn("Malformed GHTK webhook signature");
            return false;
        }
    }

    private String computeSignature(GhtkWebhookPayload payload) {
        try {
            String data = payload.labelId() + payload.status() + payload.updatedAt();
            Mac mac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKey = new SecretKeySpec(
                    properties.webhookToken().getBytes(StandardCharsets.UTF_8),
                    HMAC_SHA256);
            mac.init(secretKey);
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("Failed to compute signature", e);
        }
    }

    private boolean isInsecureLocalMode() {
        return webhookSecurityProperties.allowInsecureLocal()
                && environment.matchesProfiles("local", "dev");
    }
}
