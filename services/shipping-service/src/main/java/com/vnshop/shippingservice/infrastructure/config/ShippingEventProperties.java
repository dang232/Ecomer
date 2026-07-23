package com.vnshop.shippingservice.infrastructure.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties(prefix = "shipping.events")
@Validated
public record ShippingEventProperties(
        @NotBlank String cancelledTopic,
        @NotBlank String statusUpdatedTopic,
        @NotBlank String codCollectedTopic
) {
}
