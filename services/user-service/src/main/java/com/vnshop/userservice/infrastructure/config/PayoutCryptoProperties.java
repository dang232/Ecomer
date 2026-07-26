package com.vnshop.userservice.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration for versioned payout-destination encryption keys. */
@ConfigurationProperties(prefix = "vnshop.crypto.payout")
public record PayoutCryptoProperties(
        String keyPropertyPrefix,
        String keyEnvPrefix,
        int maxKeyVersion,
        int defaultKeyVersion) {

    public PayoutCryptoProperties {
        required(keyPropertyPrefix, "vnshop.crypto.payout.key-property-prefix");
        required(keyEnvPrefix, "vnshop.crypto.payout.key-env-prefix");
        if (maxKeyVersion <= 0) {
            throw new IllegalStateException("vnshop.crypto.payout.max-key-version must be positive");
        }
        if (defaultKeyVersion <= 0) {
            throw new IllegalStateException("vnshop.crypto.payout.default-key-version must be positive");
        }
    }

    private static void required(String value, String propertyName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(propertyName + " must be configured");
        }
    }
}
