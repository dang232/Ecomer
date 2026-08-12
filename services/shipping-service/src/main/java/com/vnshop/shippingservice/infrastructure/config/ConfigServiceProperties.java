package com.vnshop.shippingservice.infrastructure.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties(prefix = "config-service")
@Validated
public record ConfigServiceProperties(
        @NotBlank String url,
        @NotBlank String serviceName,
        boolean enabled,
        @Min(1) long timeoutMs,
        String token
) {
}
