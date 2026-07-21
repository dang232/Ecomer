package com.vnshop.shippingservice.infrastructure.webhook;

import com.vnshop.shippingservice.infrastructure.carrier.GhnProperties;
import com.vnshop.shippingservice.infrastructure.config.CarrierProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final CarrierProperties carrierProperties;

    @Autowired
    public GhnWebhookSignatureService(
            GhnProperties properties,
            CarrierProperties carrierProperties) {
        this.properties = properties;
        this.carrierProperties = carrierProperties;
    }

    public GhnWebhookSignatureService(GhnProperties properties) {
        this(properties, new CarrierProperties("stub"));
    }

    /**
     * Validates the GHN webhook signature/token.
     * GHN validates via X-GHN-Token header matching their configured token.
     */
    public boolean isValid(GhnWebhookPayload payload, String signature, String token) {
        String configuredToken = properties.webhookToken();
        if (configuredToken == null || configuredToken.isBlank()) {
            boolean localStub = !"live".equalsIgnoreCase(carrierProperties.mode());
            if (!localStub) {
                LOG.error("GHN webhook token is not configured while carrier mode is live");
            }
            return localStub && (token == null || token.isBlank());
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
}
