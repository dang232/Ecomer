package com.vnshop.userservice.domain.port.out;

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
}