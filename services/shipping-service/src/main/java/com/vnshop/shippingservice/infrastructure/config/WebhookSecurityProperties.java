package com.vnshop.shippingservice.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "shipping.webhook-security")
public record WebhookSecurityProperties(boolean allowInsecureLocal) {
}
