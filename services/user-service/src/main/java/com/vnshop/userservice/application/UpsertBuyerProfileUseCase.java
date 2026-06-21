package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.PhoneNumber;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;

public class UpsertBuyerProfileUseCase {

    private final UserRepositoryPort userRepositoryPort;
    private final RegisterBuyerUseCase registerBuyerUseCase;

    public UpsertBuyerProfileUseCase(UserRepositoryPort userRepositoryPort, RegisterBuyerUseCase registerBuyerUseCase) {
        this.userRepositoryPort = userRepositoryPort;
        this.registerBuyerUseCase = registerBuyerUseCase;
    }

    public BuyerProfile upsert(UpsertBuyerProfileCommand command) {
        // Sanitize user-supplied fields before touching domain or persistence.
        String safeName = InputSanitizer.stripHtml(command.name());
        InputSanitizer.validateAvatarUrl(command.avatarUrl());

        // Centralise the null/blank handling in PhoneNumber.parseOrNull so this
        // use case doesn't re-derive the rule. The register fallback below
        // reuses the same factory.
        PhoneNumber phone = PhoneNumber.parseOrNull(command.phone());
        return userRepositoryPort.findBuyerByKeycloakId(command.keycloakId())
                .map(existing -> {
                    existing.updateProfile(safeName, phone, command.avatarUrl());
                    return userRepositoryPort.saveBuyer(existing);
                })
                .orElseGet(() -> {
                    // The upsert path takes a single composed name; the register
                    // path splits firstName/lastName. Wrap the composed name in
                    // a FullName so the register use case stays type-safe.
                    return registerBuyerUseCase.register(new RegisterBuyerCommand(
                            command.keycloakId(),
                            com.vnshop.userservice.domain.FullName.fromComposed(safeName),
                            phone,
                            command.avatarUrl()));
                });
    }
}
