package com.vnshop.userservice.infrastructure.featureflag;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "unleash")
public record UnleashProperties(String apiUrl, String apiKey, String appName) {

    public UnleashProperties {
        required(apiUrl, "unleash.api-url");
        required(apiKey, "unleash.api-key");
        required(appName, "unleash.app-name");
    }

    private static void required(String value, String propertyName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(propertyName + " must be configured");
        }
    }
}
