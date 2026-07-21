package com.vnshop.shippingservice.infrastructure.carrier;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "shipping.carrier.ghn")
public record GhnProperties(
        String baseUrl,
        String token,
        String shopId,
        String serviceTypeId,
        String webhookToken
) {
}
