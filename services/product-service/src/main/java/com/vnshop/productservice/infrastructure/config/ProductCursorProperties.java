package com.vnshop.productservice.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "product.cursor")
public record ProductCursorProperties(String secret) {
    public ProductCursorProperties {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("product.cursor.secret must be configured");
        }
    }
}
