package com.vnshop.userservice.application;

import com.vnshop.userservice.infrastructure.keycloak.KeycloakAdminException;
import com.vnshop.userservice.infrastructure.keycloak.KeycloakTokenClient;
import com.vnshop.userservice.infrastructure.keycloak.KeycloakTokenClient.TokenSet;

import java.util.Objects;

public class AuthSessionUseCase {
    private final KeycloakTokenClient tokenClient;

    public AuthSessionUseCase(KeycloakTokenClient tokenClient) {
        this.tokenClient = Objects.requireNonNull(tokenClient, "tokenClient is required");
    }

    public TokenSet login(String username, String password) {
        return tokenClient.passwordGrant(username, password);
    }

    /**
     * Exchanges an OAuth authorization code for tokens.
     * Used for identity provider callbacks via Keycloak broker.
     *
     * @param code the authorization code from the OAuth callback
     * @param codeVerifier the PKCE code verifier
     * @param redirectUri the redirect URI used in the auth request
     * @return TokenSet with access and refresh tokens
     */
    public TokenSet exchangeCodeForTokens(String code, String codeVerifier, String redirectUri) {
        return tokenClient.authorizationCodeGrant(code, codeVerifier, redirectUri);
    }

    public TokenSet refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new NoSessionException("No refresh-token cookie present");
        }
        try {
            return tokenClient.refresh(refreshToken);
        } catch (KeycloakAdminException e) {
            throw new RefreshTokenRejectedException("Keycloak rejected the refresh token", e);
        }
    }

    public void logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        try {
            tokenClient.revoke(refreshToken);
        } catch (KeycloakAdminException ignored) {
            // Best-effort: logout always succeeds from the user's perspective.
        }
    }
}
