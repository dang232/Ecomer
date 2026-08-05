package com.vnshop.productservice.infrastructure.storage;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "vnshop.object-storage")
public class ObjectStorageProperties {
    private boolean enabled;
    private Profile profile = Profile.MINIO;
    private String bucket;
    private String reviewBucket = "vnshop-reviews";
    private String region = "auto";
    private String endpoint;
    private String publicEndpoint;
    private String accessKey;
    private String secretKey;
    private boolean pathStyleAccess = true;

    public String resolvePublicEndpoint() {
        return publicEndpoint == null || publicEndpoint.isBlank() ? endpoint : publicEndpoint;
    }

    public enum Profile {
        R2,
        MINIO
    }
}
