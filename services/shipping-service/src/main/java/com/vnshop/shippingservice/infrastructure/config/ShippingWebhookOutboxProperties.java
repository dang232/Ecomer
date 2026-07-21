package com.vnshop.shippingservice.infrastructure.config;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties(prefix = "shipping.webhook-outbox")
@Validated
public record ShippingWebhookOutboxProperties(
        @Min(1) int batchSize,
        @Min(1) long pollIntervalMs,
        @Min(1) long claimTimeoutMs,
        @Min(1) int maxAttempts,
        @Min(1) long initialBackoffSeconds,
        @Min(1) long maxBackoffSeconds,
        @Min(0) int backoffExponentCap,
        @Min(1) int maxErrorLength
) {
}
