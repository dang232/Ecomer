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