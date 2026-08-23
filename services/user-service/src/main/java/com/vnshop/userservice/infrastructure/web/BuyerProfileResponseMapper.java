package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.infrastructure.storage.ObjectStorageProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@EnableConfigurationProperties(ObjectStorageProperties.class)
public class BuyerProfileResponseMapper {
    private static final String LEGACY_LOCAL_AVATAR_PREFIX = "http://localhost:9000/vnshop-avatars/";

    private final ObjectStorageProperties storageProperties;

    public BuyerProfileResponseMapper(ObjectStorageProperties storageProperties) {
        this.storageProperties = storageProperties;
    }

    public BuyerProfileResponse fromDomain(BuyerProfile buyerProfile) {
        return new BuyerProfileResponse(
                buyerProfile.keycloakId(),
                buyerProfile.email(),
                buyerProfile.name(),
                buyerProfile.phone() == null ? null : buyerProfile.phone().value(),
                normalizeAvatarUrl(buyerProfile.avatarUrl()),
                buyerProfile.banned(),
                buyerProfile.addresses().stream().map(AddressResponse::fromDomain).toList()
        );
    }

    private String normalizeAvatarUrl(String avatarUrl) {
        if (avatarUrl == null || !avatarUrl.startsWith(LEGACY_LOCAL_AVATAR_PREFIX)) {
            return avatarUrl;
        }
        String endpoint = storageProperties.resolvePublicEndpoint();
        String bucket = storageProperties.getBucket();
        String remainingKey = avatarUrl.substring(LEGACY_LOCAL_AVATAR_PREFIX.length());
        return trimTrailingSlash(endpoint) + "/" + trimSlashes(bucket) + "/" + remainingKey;
    }

    private static String trimTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private static String trimSlashes(String value) {
        int start = value.startsWith("/") ? 1 : 0;
        int end = value.endsWith("/") ? value.length() - 1 : value.length();
        return value.substring(start, end);
    }
}
