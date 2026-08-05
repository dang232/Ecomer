package com.vnshop.productservice.infrastructure.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "vnshop.object-storage.video")
public record VideoStorageProperties(String inputBucket, String stagingBucket, String publicBucket) {
    public VideoStorageProperties {
        if (inputBucket == null || inputBucket.isBlank()) {
            throw new IllegalStateException("vnshop.object-storage.video.input-bucket must be configured");
        }
        if (stagingBucket == null || stagingBucket.isBlank()) {
            throw new IllegalStateException("vnshop.object-storage.video.staging-bucket must be configured");
        }
        if (publicBucket == null || publicBucket.isBlank()) {
            throw new IllegalStateException("vnshop.object-storage.video.public-bucket must be configured");
        }
    }
}
