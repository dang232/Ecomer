package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;

public class ViewBuyerProfileUseCase {

    private final UserRepositoryPort userRepositoryPort;

    public ViewBuyerProfileUseCase(UserRepositoryPort userRepositoryPort) {
        this.userRepositoryPort = userRepositoryPort;
    }

    public BuyerProfile view(String keycloakId) {
        return userRepositoryPort.findBuyerByKeycloakId(keycloakId)
                .orElseGet(() -> userRepositoryPort.saveBuyer(BuyerProfile.createDefault(keycloakId)));
    }
}
