package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;

import java.util.Objects;

public class RejectSellerUseCase {
    private final UserRepositoryPort userRepositoryPort;

    public RejectSellerUseCase(UserRepositoryPort userRepositoryPort) {
        this.userRepositoryPort = Objects.requireNonNull(userRepositoryPort, "userRepositoryPort is required");
    }

    public SellerProfile reject(String sellerId, String reason) {
        SellerProfile sellerProfile = userRepositoryPort.findSellerById(sellerId)
                .orElseThrow(() -> new IllegalArgumentException("seller profile not found"));
        sellerProfile.reject(reason);
        return userRepositoryPort.updateSeller(sellerProfile);
    }
}
