package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.port.out.KeycloakAdminPort;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;

import java.util.Objects;

public class ApproveSellerUseCase {
    private final UserRepositoryPort userRepositoryPort;
    private final KeycloakAdminPort keycloakAdminPort;

    public ApproveSellerUseCase(UserRepositoryPort userRepositoryPort, KeycloakAdminPort keycloakAdminPort) {
        this.userRepositoryPort = Objects.requireNonNull(userRepositoryPort, "userRepositoryPort is required");
        this.keycloakAdminPort = Objects.requireNonNull(keycloakAdminPort, "keycloakAdminPort is required");
    }

    public SellerProfile approve(String sellerId) {
        SellerProfile sellerProfile = userRepositoryPort.findSellerById(sellerId)
                .orElseThrow(() -> new IllegalArgumentException("seller profile not found"));
        // Grant the capability before publishing approval. If Keycloak is
        // unavailable, the application remains pending and stays actionable
        // in the admin queue instead of becoming an approved-but-unusable shop.
        keycloakAdminPort.assignSellerRole(sellerProfile.id());
        sellerProfile.approve();
        return userRepositoryPort.updateSeller(sellerProfile);
    }
}
