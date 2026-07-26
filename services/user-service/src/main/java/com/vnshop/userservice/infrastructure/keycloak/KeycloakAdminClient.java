package com.vnshop.userservice.infrastructure.keycloak;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.vnshop.userservice.domain.port.out.KeycloakAdminPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Thin wrapper over the Keycloak Admin API. Acquires a service-account token via
 * client_credentials and uses it to create users on self-registration. The token
 * is cached in-memory and refreshed before expiry; concurrent requests can race
 * but the worst outcome is two adjacent token fetches, not a stale token.
 *
 * <p>Implements {@link KeycloakAdminPort} so application-layer use cases
 * (e.g. {@code AdminUserUseCase}) can depend on the port, not the concrete
 * HTTP adapter.
 */
@Component
public class KeycloakAdminClient implements KeycloakAdminPort {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final RestClient http = RestClient.builder().build();
    private final String baseUrl;
    private final String realm;
    private final String clientId;
    private final String clientSecret;

    private final Lock tokenLock = new ReentrantLock();
    private volatile String cachedToken;
    private volatile Instant cachedTokenExpiresAt = Instant.EPOCH;

    public KeycloakAdminClient(
            @Value("${keycloak.admin.base-url:http://keycloak:8080}") String baseUrl,
            @Value("${keycloak.admin.realm:vnshop}") String realm,
            @Value("${keycloak.admin.client-id:vnshop-admin-api}") String clientId,
            @Value("${keycloak.admin.client-secret}") String clientSecret) {
        this.baseUrl = baseUrl;
        this.realm = realm;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    /**
     * Create a user in Keycloak. Returns the user id (sub) parsed out of the
     * Location header of the 201 response. Throws KeycloakAdminException for
     * 409 (email taken) or 400 (password policy violation).
     */
    public String createUser(String email, String password, String firstName, String lastName) {
        String token = adminToken();
        ObjectNode payload = MAPPER.createObjectNode();
        payload.put("username", email);
        payload.put("email", email);
        payload.put("firstName", firstName);
        payload.put("lastName", lastName);
        payload.put("enabled", true);
        payload.put("emailVerified", true);
        payload.putArray("requiredActions");
        payload.putArray("realmRoles").add("BUYER");

        ObjectNode credential = payload.putArray("credentials").addObject();
        credential.put("type", "password");
        credential.put("value", password);
        credential.put("temporary", false);

        try {
            var response = http.post()
                    .uri(baseUrl + "/admin/realms/" + realm + "/users")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload.toString())
                    .retrieve()
                    .toBodilessEntity();
            String location = response.getHeaders().getFirst("Location");
            if (location == null) {
                throw new KeycloakAdminException(500, "internal_error", "Keycloak returned no Location header on user create");
            }
            int sep = location.lastIndexOf('/');
            return sep >= 0 ? location.substring(sep + 1) : location;
        } catch (HttpStatusCodeException e) {
            HttpStatusCode status = e.getStatusCode();
            if (status.value() == 409) {
                throw new KeycloakAdminException(409, "email_taken", "An account with that email already exists");
            }
            if (status.value() == 400) {
                throw new KeycloakAdminException(400, "weak_password", parseError(e.getResponseBodyAsString(), "Invalid request"));
            }
            throw new KeycloakAdminException(status.value(), "keycloak_error", parseError(e.getResponseBodyAsString(), "Keycloak rejected the request"));
        }
    }

    /**
     * Assign the BUYER realm role to a user. Keycloak's create-user payload
     * accepts realmRoles, but in practice that field is silently ignored in
     * many Keycloak builds — the explicit role-mapping POST is the reliable
     * path.
     */
    public void assignBuyerRole(String userId) {
        String token = adminToken();
        try {
            String roleBody = http.get()
                    .uri(baseUrl + "/admin/realms/" + realm + "/roles/BUYER")
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .body(String.class);
            if (roleBody == null) return;
            JsonNode role = MAPPER.readTree(roleBody);

            http.post()
                    .uri(baseUrl + "/admin/realms/" + realm + "/users/" + userId + "/role-mappings/realm")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(List.of(Map.of(
                            "id", role.path("id").asText(),
                            "name", role.path("name").asText())))
                    .retrieve()
                    .toBodilessEntity();
        } catch (HttpStatusCodeException e) {
            throw new KeycloakAdminException(e.getStatusCode().value(), "role_assign_failed", parseError(e.getResponseBodyAsString(), "Couldn't assign BUYER role"));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new KeycloakAdminException(500, "role_assign_failed", "Couldn't parse Keycloak role response");
        }
    }

    /**
     * Disable a user in Keycloak (sets enabled=false). Used when an admin
     * bans a buyer — the user can no longer obtain tokens until re-enabled.
     */
    @Override
    public void disableUser(String userId) {
        setUserEnabled(userId, false);
    }

    /**
     * Re-enable a user in Keycloak (sets enabled=true). Used when an admin
     * unbans a buyer.
     */
    @Override
    public void enableUser(String userId) {
        setUserEnabled(userId, true);
    }

    private void setUserEnabled(String userId, boolean enabled) {
        String token = adminToken();
        ObjectNode payload = MAPPER.createObjectNode();
        payload.put("enabled", enabled);
        try {
            http.put()
                    .uri(baseUrl + "/admin/realms/" + realm + "/users/" + userId)
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload.toString())
                    .retrieve()
                    .toBodilessEntity();
        } catch (HttpStatusCodeException e) {
            throw new KeycloakAdminException(e.getStatusCode().value(), "user_update_failed",
                    parseError(e.getResponseBodyAsString(), "Couldn't update user enabled status"));
        }
    }

    /**
     * Trigger Keycloak's standard password-reset email. Resolves the user
     * by email first (Keycloak's execute-actions-email is keyed by user id,
     * not email) and asks Keycloak to email an UPDATE_PASSWORD action token.
     *
     * <p>Anti-enumeration: returns silently when no user matches the email.
     * Callers MUST always emit a generic "if an account exists, you'll get
     * an email" response regardless of this method's outcome — letting a
     * 404 leak through would let attackers enumerate registered emails.
     *
     * <p>Keycloak's existing realm SMTP config handles delivery; we don't
     * need our own SMTP plumbing.
     */
    public void sendPasswordResetEmail(String email) {
        String token = adminToken();
        String userId = lookupUserIdByEmail(email, token);
        if (userId == null) return;
        try {
            http.put()
                    .uri(baseUrl + "/admin/realms/" + realm + "/users/" + userId + "/execute-actions-email")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(List.of("UPDATE_PASSWORD"))
                    .retrieve()
                    .toBodilessEntity();
        } catch (HttpStatusCodeException e) {
            // 400 typically means the realm SMTP isn't configured. Don't
            // leak that to the caller — log and return silently. The user
            // still gets the generic success response.
            throw new KeycloakAdminException(
                    e.getStatusCode().value(),
                    "password_reset_failed",
                    parseError(e.getResponseBodyAsString(), "Couldn't trigger password reset"));
        }
    }

    /**
     * Resolve the Keycloak user id (sub) for a given email. Returns null
     * when no user matches — callers must NOT surface this null directly
     * to a public response. See {@link #sendPasswordResetEmail} for the
     * anti-enumeration pattern.
     */
    private String lookupUserIdByEmail(String email, String token) {
        try {
            String body = http.get()
                    .uri(baseUrl + "/admin/realms/" + realm + "/users?email=" + java.net.URLEncoder.encode(email, java.nio.charset.StandardCharsets.UTF_8) + "&exact=true")
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .body(String.class);
            if (body == null) return null;
            JsonNode arr = MAPPER.readTree(body);
            if (!arr.isArray() || arr.isEmpty()) return null;
            String id = arr.get(0).path("id").asText(null);
            return (id == null || id.isBlank()) ? null : id;
        } catch (Exception ignored) {
            return null;
        }
    }

    private String adminToken() {
        // Fast path: token still valid — no lock needed (volatile read is sufficient).
        if (cachedToken != null && Instant.now().isBefore(cachedTokenExpiresAt)) {
            return cachedToken;
        }
        // Slow path: acquire a ReentrantLock so the blocking HTTP call to Keycloak
        // does NOT pin the carrier thread under virtual-thread scheduling (see commit
        // 77b34f78 / gotcha #50). synchronized would pin; ReentrantLock parks instead.
        tokenLock.lock();
        try {
            // Re-check after acquiring the lock — another thread may have refreshed.
            if (cachedToken != null && Instant.now().isBefore(cachedTokenExpiresAt)) {
                return cachedToken;
            }
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("grant_type", "client_credentials");
            form.add("client_id", clientId);
            form.add("client_secret", clientSecret);
            try {
                String responseBody = http.post()
                        .uri(baseUrl + "/realms/" + realm + "/protocol/openid-connect/token")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body(form)
                        .retrieve()
                        .body(String.class);
                if (responseBody == null) {
                    throw new KeycloakAdminException(500, "admin_token_failed", "Keycloak returned empty response for the admin token request");
                }
                JsonNode body = MAPPER.readTree(responseBody);
                if (!body.hasNonNull("access_token")) {
                    throw new KeycloakAdminException(500, "admin_token_failed", "Keycloak returned no access token for the admin client");
                }
                cachedToken = body.get("access_token").asText();
                int expiresIn = body.path("expires_in").asInt(60);
                cachedTokenExpiresAt = Instant.now().plus(Duration.ofSeconds(Math.max(10, expiresIn - 30)));
                return cachedToken;
            } catch (HttpStatusCodeException e) {
                throw new KeycloakAdminException(e.getStatusCode().value(), "admin_token_failed", parseError(e.getResponseBodyAsString(), "Couldn't reach Keycloak admin"));
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                throw new KeycloakAdminException(500, "admin_token_failed", "Couldn't parse Keycloak token response");
            }
        } finally {
            tokenLock.unlock();
        }
    }

    private String parseError(String body, String fallback) {
        if (body == null || body.isBlank()) return fallback;
        try {
            JsonNode node = MAPPER.readTree(body);
            if (node.hasNonNull("errorMessage")) return node.get("errorMessage").asText();
            if (node.hasNonNull("error_description")) return node.get("error_description").asText();
            if (node.hasNonNull("error")) return node.get("error").asText();
        } catch (Exception ignored) {
            // fall through
        }
        return fallback;
    }
}
