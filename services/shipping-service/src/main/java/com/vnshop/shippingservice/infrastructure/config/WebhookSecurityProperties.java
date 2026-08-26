package com.vnshop.shippingservice.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "shipping.webhook-security")
public record WebhookSecurityProperties(boolean allowInsecureLocal, long replayWindowSeconds) {
    private static final long DEFAULT_REPLAY_WINDOW_SECONDS = 300;

    public WebhookSecurityProperties {
        if (replayWindowSeconds <= 0 || replayWindowSeconds > DEFAULT_REPLAY_WINDOW_SECONDS) {
            throw new IllegalArgumentException("replayWindowSeconds must be between 1 and 300 seconds");
        }
    }

    public WebhookSecurityProperties(boolean allowInsecureLocal) {
        this(allowInsecureLocal, DEFAULT_REPLAY_WINDOW_SECONDS);
    }
}
