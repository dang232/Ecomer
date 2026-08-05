package com.vnshop.userservice.domain.port.out;

import java.util.Optional;

/**
 * Outbound port for Keycloak admin operations the application layer needs.
 *
 * <p>Defined in the domain layer so that {@code application} use cases can
 * depend on it without coupling to the concrete Keycloak HTTP adapter that
 * lives in {@code infrastructure.keycloak}.
 */
public interface KeycloakAdminPort {

    /** Disable a Keycloak user by id (sets {@code enabled=false}). */
    void disableUser(String keycloakUserId);

    /** Re-enable a Keycloak user by id (sets {@code enabled=true}). */
    void enableUser(String keycloakUserId);

    /** Delete a just-created user when registration cannot materialize its profile. */
    void deleteUser(String keycloakUserId);

    /** Assign the SELLER realm role after an admin approves the seller profile. */
    void assignSellerRole(String keycloakUserId);

    /**
     * Read the identity-provider email only to recover legacy profiles that
     * predate user-service email ownership. Callers must persist the value and
     * must never use this as an ongoing profile-email source.
     */
    Optional<String> findEmailByUserId(String keycloakUserId);
}
