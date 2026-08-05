package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.PhoneNumber;
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
        var existing = userRepositoryPort.findBuyerByKeycloakId(command.keycloakId());
        if (existing.isPresent()) {
            BuyerProfile profile = existing.get();
            return profile.backfillEmailIfMissing(command.email())
                    ? userRepositoryPort.saveBuyer(profile)
                    : profile;
        }
        assertPhoneAvailable(command.phone(), command.keycloakId());
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

    /**
     * Performs the readable preflight check. Persistence still owns the final
     * race-safe claim through its unique constraint.
     */
    public void assertPhoneAvailable(PhoneNumber phone) {
        assertPhoneAvailable(phone, null);
    }

    public void assertPhoneAvailable(PhoneNumber phone, String ownerKeycloakId) {
        if (phone == null) {
            return;
        }
        userRepositoryPort.findBuyerByPhone(phone)
                .filter(existing -> !existing.keycloakId().equals(ownerKeycloakId))
                .ifPresent(existing -> {
                    throw new PhoneAlreadyRegisteredException();
                });
    }
}
