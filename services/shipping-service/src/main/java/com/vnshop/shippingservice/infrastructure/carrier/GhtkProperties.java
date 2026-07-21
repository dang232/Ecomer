package com.vnshop.shippingservice.infrastructure.carrier;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "shipping.carrier.ghtk")
public record GhtkProperties(
        String baseUrl,
        String token,
        String partnerCode,
        String webhookToken
) {
}
