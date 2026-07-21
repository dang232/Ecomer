package com.vnshop.shippingservice.infrastructure.webhook;

import com.vnshop.shippingservice.infrastructure.carrier.GhnProperties;
import com.vnshop.shippingservice.infrastructure.config.WebhookSecurityProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Service to verify GHN webhook signatures/tokens.
 * GHN uses token-based verification via headers.
 */
@Component
public class GhnWebhookSignatureService {
    private static final Logger LOG = LoggerFactory.getLogger(GhnWebhookSignatureService.class);

    private final GhnProperties properties;
    private final WebhookSecurityProperties webhookSecurityProperties;
    private final Environment environment;

    @Autowired
    public GhnWebhookSignatureService(
            GhnProperties properties,
            WebhookSecurityProperties webhookSecurityProperties,
            Environment environment) {
        this.properties = properties;
        this.webhookSecurityProperties = webhookSecurityProperties;
        this.environment = environment;
    }

    public GhnWebhookSignatureService(GhnProperties properties) {
        this(properties, new WebhookSecurityProperties(false), new StandardEnvironment());
    }

    /**
     * Validates the GHN webhook signature/token.
     * GHN validates via X-GHN-Token header matching their configured token.
     */
    public boolean isValid(GhnWebhookPayload payload, String signature, String token) {
        String configuredToken = properties.webhookToken();
        if (configuredToken == null || configuredToken.isBlank()) {
            if (isInsecureLocalMode()) {
                LOG.warn("Accepting GHN webhook without credentials because explicit local-only opt-in is enabled");
                return true;
            }
            LOG.error("GHN webhook token is not configured");
            return false;
        }

        if (token == null || token.isBlank()) {
            LOG.warn("GHN webhook token is missing");
            return false;
        }

        boolean valid = MessageDigest.isEqual(
                configuredToken.getBytes(StandardCharsets.UTF_8),
                token.getBytes(StandardCharsets.UTF_8));
        if (!valid) {
            LOG.warn("Invalid GHN token");
        }
        return valid;
    }

    private boolean isInsecureLocalMode() {
        return webhookSecurityProperties.allowInsecureLocal()
                && environment.matchesProfiles("local", "dev");
    }
}
