package com.vnshop.sellerfinanceservice.infrastructure.user;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "vnshop.user-service")
public class UserServiceClientProperties {
    private String baseUrl;
    private long connectTimeoutMs;
    private long readTimeoutMs;
    private String internalToken;

    public String baseUrl() {
        return requireText(baseUrl, "vnshop.user-service.base-url");
    }

    public long connectTimeoutMs() {
        return requirePositive(connectTimeoutMs, "vnshop.user-service.connect-timeout-ms");
    }

    public long readTimeoutMs() {
        return requirePositive(readTimeoutMs, "vnshop.user-service.read-timeout-ms");
    }

    public String internalToken() {
        return requireText(internalToken, "vnshop.user-service.internal-token");
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public void setConnectTimeoutMs(long connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    public void setReadTimeoutMs(long readTimeoutMs) {
        this.readTimeoutMs = readTimeoutMs;
    }

    public void setInternalToken(String internalToken) {
        this.internalToken = internalToken;
    }

    private static String requireText(String value, String propertyName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(propertyName + " must be configured");
        }
        return value;
    }

    private static long requirePositive(long value, String propertyName) {
        if (value <= 0) {
            throw new IllegalStateException(propertyName + " must be positive");
        }
        return value;
    }
}
