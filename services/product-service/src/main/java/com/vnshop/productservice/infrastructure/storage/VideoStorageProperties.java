package com.vnshop.productservice.infrastructure.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "vnshop.object-storage.video")
public record VideoStorageProperties(String publicBucket) {
    public VideoStorageProperties {
        if (publicBucket == null || publicBucket.isBlank()) {
            throw new IllegalStateException("vnshop.object-storage.video.public-bucket must be configured");
        }
    }
}
