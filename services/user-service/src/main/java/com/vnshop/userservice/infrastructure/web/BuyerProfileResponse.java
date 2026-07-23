package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.domain.BuyerProfile;

import java.util.List;

public record BuyerProfileResponse(String keycloakId, String email, String name, String phone, String avatarUrl, boolean banned, List<AddressResponse> addresses) {
    static BuyerProfileResponse fromDomain(BuyerProfile buyerProfile) {
        return new BuyerProfileResponse(
                buyerProfile.keycloakId(),
                buyerProfile.email(),
                buyerProfile.name(),
                buyerProfile.phone() == null ? null : buyerProfile.phone().value(),
                buyerProfile.avatarUrl(),
                buyerProfile.banned(),
                buyerProfile.addresses().stream().map(AddressResponse::fromDomain).toList()
        );
    }
}
