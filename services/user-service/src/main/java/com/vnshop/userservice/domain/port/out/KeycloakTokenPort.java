package com.vnshop.userservice.domain.port.out;

/**
 * Outbound port for Keycloak token-grant operations the application layer
 * needs: password grant, authorization-code exchange, refresh, revoke.
 *
 * <p>Defined in the domain layer so that {@code application} use cases can
 * depend on it without coupling to the concrete Keycloak HTTP adapter that
 * lives in {@code infrastructure.keycloak}.
 */
public interface KeycloakTokenPort {

    /** Token response for any grant that produces a token pair. */
    record TokenSet(
            String accessToken,
            String refreshToken,
            int accessExpiresIn,
            int refreshExpiresIn
    ) {}

    /** Resource Owner Password Credentials grant (cookie session login). */
    TokenSet passwordGrant(String username, String password);

    /** Authorization-code exchange (OAuth/OIDC broker callback). */
    TokenSet authorizationCodeGrant(String code, String codeVerifier, String redirectUri);

    /** Refresh-token grant — may throw on rejection. */
    TokenSet refresh(String refreshToken);

    /** Best-effort token revocation; swallow failures. */
    void revoke(String refreshToken);
}