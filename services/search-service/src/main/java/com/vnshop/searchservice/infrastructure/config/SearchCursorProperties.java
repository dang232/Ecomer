package com.vnshop.searchservice.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "search.cursor")
public record SearchCursorProperties(String secret) {
    public SearchCursorProperties {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("search.cursor.secret must be configured");
        }
    }
}
