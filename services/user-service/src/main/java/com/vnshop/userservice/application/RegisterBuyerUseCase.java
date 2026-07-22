package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;

import java.util.List;
import java.util.Objects;

public class RegisterBuyerUseCase {
    private final UserRepositoryPort userRepositoryPort;

    public RegisterBuyerUseCase(UserRepositoryPort userRepositoryPort) {
        this.userRepositoryPort = Objects.requireNonNull(userRepositoryPort, "userRepositoryPort is required");
    }

    public BuyerProfile register(RegisterBuyerCommand command) {
        // No null/blank handling here: PhoneNumber.parseOrNull was called by the
        // controller, so `command.phone()` is either a valid PhoneNumber or null.
        BuyerProfile buyerProfile = new BuyerProfile(
                command.keycloakId(),
                command.email(),
                command.name().value(),
                command.phone(),
                command.avatarUrl(),
                List.of()
        );
        return userRepositoryPort.saveBuyer(buyerProfile);
    }
}
