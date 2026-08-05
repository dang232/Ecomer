package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.port.out.KeycloakAdminPort;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;

public class ViewBuyerProfileUseCase {
    private static final Logger log = LoggerFactory.getLogger(ViewBuyerProfileUseCase.class);

    private final UserRepositoryPort userRepositoryPort;
    private final KeycloakAdminPort keycloakAdminPort;

    public ViewBuyerProfileUseCase(
            UserRepositoryPort userRepositoryPort,
            KeycloakAdminPort keycloakAdminPort) {
        this.userRepositoryPort = userRepositoryPort;
        this.keycloakAdminPort = keycloakAdminPort;
    }

    public BuyerProfile view(String keycloakId) {
        return userRepositoryPort.findBuyerByKeycloakId(keycloakId)
                .map(this::backfillLegacyEmail)
                .orElseGet(() -> createProfile(keycloakId));
    }

    private BuyerProfile createProfile(String keycloakId) {
        return userRepositoryPort.saveBuyer(BuyerProfile.createDefault(
                keycloakId,
                findLegacyEmail(keycloakId).orElse(null)));
    }

    private BuyerProfile backfillLegacyEmail(BuyerProfile profile) {
        if (profile.email() != null) {
            return profile;
        }
        Optional<String> email = findLegacyEmail(profile.keycloakId());
        if (email.isPresent() && profile.backfillEmailIfMissing(email.get())) {
            return userRepositoryPort.saveBuyer(profile);
        }
        return profile;
    }

    private Optional<String> findLegacyEmail(String keycloakId) {
        try {
            return keycloakAdminPort.findEmailByUserId(keycloakId);
        } catch (RuntimeException ex) {
            // A Keycloak outage must not make a valid signed-in profile unreadable.
            // The next profile read will retry this one-way legacy recovery.
            log.warn("could not backfill email for keycloakId={}: {}", keycloakId, ex.getMessage());
            return Optional.empty();
        }
    }
}
