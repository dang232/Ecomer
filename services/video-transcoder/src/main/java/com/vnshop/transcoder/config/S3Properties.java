package com.vnshop.transcoder.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "vnshop.s3")
public record S3Properties(String endpoint, String region, String accessKey, String secretKey) {
    public S3Properties {
        region = required(region, "vnshop.s3.region");
        accessKey = required(accessKey, "vnshop.s3.access-key");
        secretKey = required(secretKey, "vnshop.s3.secret-key");
    }

    private static String required(String value, String propertyName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(propertyName + " must be configured");
        }
        return value;
    }
}
