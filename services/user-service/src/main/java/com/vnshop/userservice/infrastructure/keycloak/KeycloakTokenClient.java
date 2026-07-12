package com.vnshop.userservice.infrastructure.keycloak;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;

/**
 * Sibling of {@link KeycloakAdminClient} for the OAuth flows that the
 * httpOnly-cookie auth surface needs:
 *
 * <ul>
 *   <li>{@link #passwordGrant(String, String)} — ROPC. Used by
 *       {@code POST /auth/login} so credentials never reach the FE bundle.</li>
 *   <li>{@link #refresh(String)} — refresh-token grant. Used by
 *       {@code POST /auth/refresh} on the cookie boundary.</li>
 *   <li>{@link #revoke(String)} — token revocation. Best-effort logout.</li>
 * </ul>
 *
 * <p>Keeps the public {@code vnshop-api} client on the request — same client
 * the FE used to hit directly. The realm doesn't change; we just relay.
 */
@Component
public class KeycloakTokenClient {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final RestClient http = RestClient.builder().build();
    private final String baseUrl;
    private final String realm;
    private final String clientId;

    public KeycloakTokenClient(
            @Value("${keycloak.token.base-url:http://keycloak:8080}") String baseUrl,
            @Value("${keycloak.token.realm:vnshop}") String realm,
            @Value("${keycloak.token.client-id:vnshop-api}") String clientId) {
        this.baseUrl = baseUrl;
        this.realm = realm;
        this.clientId = clientId;
    }

    public TokenSet passwordGrant(String username, String password) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "password");
        form.add("client_id", clientId);
        form.add("username", username);
        form.add("password", password);
        return tokenRequest(form, "invalid_credentials");
    }

    public TokenSet refresh(String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("client_id", clientId);
        form.add("refresh_token", refreshToken);
        return tokenRequest(form, "refresh_failed");
    }

    public void revoke(String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("refresh_token", refreshToken);
        try {
            http.post()
                    .uri(baseUrl + "/realms/" + realm + "/protocol/openid-connect/logout")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception ignored) {
            // Best-effort: the cookie still gets cleared by the controller,
            // and Keycloak will eventually expire the refresh token on its own.
        }
    }

    /**
     * Exchanges an authorization code for tokens using the authorization_code grant.
     * Used for OAuth/OIDC identity provider callbacks via Keycloak broker.
     *
     * @param code the authorization code from the callback
     * @param codeVerifier the PKCE code verifier (for S256 challenge)
     * @param redirectUri the redirect URI used in the original auth request
     * @return TokenSet with access and refresh tokens
     */
    public TokenSet authorizationCodeGrant(String code, String codeVerifier, String redirectUri) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", clientId);
        form.add("code", code);
        form.add("redirect_uri", redirectUri);
        if (codeVerifier != null && !codeVerifier.isBlank()) {
            form.add("code_verifier", codeVerifier);
        }
        return tokenRequest(form, "oauth_exchange_failed");
    }

    private TokenSet tokenRequest(MultiValueMap<String, String> form, String errorCodeOnFailure) {
        try {
            String body = http.post()
                    .uri(baseUrl + "/realms/" + realm + "/protocol/openid-connect/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(String.class);
            if (body == null) {
                throw new KeycloakAdminException(500, errorCodeOnFailure, "Empty response from Keycloak token endpoint");
            }
            JsonNode node = MAPPER.readTree(body);
            String accessToken = node.path("access_token").asText(null);
            String refreshToken = node.path("refresh_token").asText(null);
            int accessExpiresIn = node.path("expires_in").asInt(0);
            int refreshExpiresIn = node.path("refresh_expires_in").asInt(0);
            if (accessToken == null || refreshToken == null) {
                throw new KeycloakAdminException(500, errorCodeOnFailure, "Keycloak response missing tokens");
            }
            return new TokenSet(accessToken, refreshToken, accessExpiresIn, refreshExpiresIn);
        } catch (HttpStatusCodeException e) {
            // Keycloak returns 400 with `error: invalid_grant` for bad
            // credentials — surface as 401 invalid_credentials so the FE
            // reads it consistently. 401 from Keycloak is mapped the same.
            int status = e.getStatusCode().value();
            String code = (status == 400 || status == 401) ? "invalid_credentials" : errorCodeOnFailure;
            int responseStatus = (status == 400 || status == 401) ? 401 : status;
            String message = parseError(e.getResponseBodyAsString());
            throw new KeycloakAdminException(responseStatus, code, message);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new KeycloakAdminException(500, errorCodeOnFailure, "Couldn't parse Keycloak token response");
        }
    }

    private String parseError(String body) {
        if (body == null || body.isBlank()) return "Authentication failed";
        try {
            JsonNode node = MAPPER.readTree(body);
            if (node.hasNonNull("error_description")) return node.get("error_description").asText();
            if (node.hasNonNull("error")) return node.get("error").asText();
        } catch (Exception ignored) {
            // fall through
        }
        return "Authentication failed";
    }

    public record TokenSet(
            String accessToken,
            String refreshToken,
            int accessExpiresIn,
            int refreshExpiresIn
    ) {}
}
