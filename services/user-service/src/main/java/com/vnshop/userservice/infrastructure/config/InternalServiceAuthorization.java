package com.vnshop.userservice.infrastructure.config;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** Fail-closed allow-list for service-account bearer tokens on internal routes. */
public final class InternalServiceAuthorization {
    private final String allowedClientId;

    public InternalServiceAuthorization(String allowedClientId) {
        if (allowedClientId == null || allowedClientId.isBlank()) {
            throw new IllegalArgumentException("allowedClientId is required");
        }
        this.allowedClientId = allowedClientId;
    }

    public boolean isAuthorized(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)) return false;
        Object azp = jwtAuthentication.getTokenAttributes().get("azp");
        Object clientId = jwtAuthentication.getTokenAttributes().get("client_id");
        String presented = azp instanceof String ? (String) azp : clientId instanceof String ? (String) clientId : null;
        return allowedClientId.equals(presented);
    }
}
