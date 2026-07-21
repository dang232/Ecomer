package com.vnshop.shippingservice.infrastructure.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties(prefix = "shipping.carrier")
@Validated
public record CarrierProperties(@NotBlank String mode) {
}
