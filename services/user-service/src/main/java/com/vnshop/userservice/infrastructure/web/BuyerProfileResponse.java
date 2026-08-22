package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.domain.BuyerProfile;

import java.util.List;

public record BuyerProfileResponse(String keycloakId, String email, String name, String phone, String avatarUrl, boolean banned, List<AddressResponse> addresses) {
    private static final String LEGACY_LOCAL_AVATAR_PREFIX = "http://localhost:9000/vnshop-avatars/";
    private static final String LOCAL_AVATAR_PREFIX = "http://localhost:8080/vnshop-avatars/";

    static BuyerProfileResponse fromDomain(BuyerProfile buyerProfile) {
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

    private static String normalizeAvatarUrl(String avatarUrl) {
        return avatarUrl != null && avatarUrl.startsWith(LEGACY_LOCAL_AVATAR_PREFIX)
                ? LOCAL_AVATAR_PREFIX + avatarUrl.substring(LEGACY_LOCAL_AVATAR_PREFIX.length())
                : avatarUrl;
    }
}
