package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.Tier;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;

import java.util.Objects;

public class RegisterSellerUseCase {
    private final UserRepositoryPort userRepositoryPort;

    public RegisterSellerUseCase(UserRepositoryPort userRepositoryPort) {
        this.userRepositoryPort = Objects.requireNonNull(userRepositoryPort, "userRepositoryPort is required");
    }

    public SellerProfile register(RegisterSellerCommand command) {
        var existing = userRepositoryPort.findSellerById(command.keycloakId());
        if (existing.isPresent()) {
            // Seller identity is the Keycloak subject. Repeated submissions must
            // return the existing application instead of replacing its shop.
            return existing.get();
        }

        SellerProfile sellerProfile = new SellerProfile(
                command.keycloakId(),
                command.shopName(),
                command.bankName(),
                null,
                false,
                Tier.STANDARD,
                false
        );
        return userRepositoryPort.saveSeller(sellerProfile);
    }
}
