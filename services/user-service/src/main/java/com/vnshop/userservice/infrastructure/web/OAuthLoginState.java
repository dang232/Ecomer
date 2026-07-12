package com.vnshop.userservice.infrastructure.web;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;

/**
 * Stores OAuth state and PKCE verifier for the authorization code flow.
 * Stores state in Redis so a callback can be handled by any service replica.
 */
@Component
public class OAuthLoginState {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Duration STATE_EXPIRY = Duration.ofMinutes(10);
    private static final String KEY_PREFIX = "auth:oauth:state:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public OAuthLoginState(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public record StateRecord(
            String provider,
            String codeVerifier,
            String codeChallenge,
            String returnTo
    ) {}

    /**
     * Generates a cryptographically random state token and associated PKCE verifier.
     * @param provider the OAuth provider alias (google, facebook)
     * @param returnTo the sanitized return path after successful auth
     * @return the state token to send to Keycloak
     */
    public String createState(String provider, String returnTo) {
        String state = generateRandomToken();
        String codeVerifier = generateRandomToken();
        String codeChallenge = generateCodeChallenge(codeVerifier);

        StateRecord record = new StateRecord(
                provider,
                codeVerifier,
                codeChallenge,
                returnTo
        );

        store(state, record);
        return state;
    }

    /**
     * Returns both state and code challenge in one call.
     * @param provider the OAuth provider alias
     * @param returnTo the sanitized return path
     * @return record containing state and code challenge
     */
    public StateWithChallenge createStateWithChallenge(String provider, String returnTo) {
        String state = generateRandomToken();
        String codeVerifier = generateRandomToken();
        String codeChallenge = generateCodeChallenge(codeVerifier);

        StateRecord record = new StateRecord(
                provider,
                codeVerifier,
                codeChallenge,
                returnTo
        );

        store(state, record);
        return new StateWithChallenge(state, codeChallenge);
    }

    public record StateWithChallenge(String state, String codeChallenge) {}

    /**
     * Validates and consumes a state token from the OAuth callback.
     * Uses Redis GETDEL for atomic get-and-delete to prevent replay across replicas.
     * @param state the state token from the callback
     * @return the StateRecord if valid, null if missing/expired
     */
    public StateRecord consumeState(String state) {
        if (state == null || state.isBlank()) {
            return null;
        }

        String serialized = redisTemplate.opsForValue().getAndDelete(KEY_PREFIX + state);
        if (serialized == null) {
            return null;
        }
        try {
            return objectMapper.readValue(serialized, StateRecord.class);
        } catch (RuntimeException exception) {
            throw new IllegalStateException("Stored OAuth state is invalid", exception);
        }
    }

    /**
     * Extracts the PKCE code verifier from a state record.
     * @param record the state record
     * @return the code verifier
     */
    public String getCodeVerifier(StateRecord record) {
        if (record == null) {
            return null;
        }
        return record.codeVerifier();
    }

    /**
     * Extracts the PKCE code challenge from a state record.
     * @param record the state record
     * @return the code challenge
     */
    public String getCodeChallenge(StateRecord record) {
        if (record == null) {
            return null;
        }
        return record.codeChallenge();
    }

    private void store(String state, StateRecord record) {
        try {
            redisTemplate.opsForValue().set(
                    KEY_PREFIX + state,
                    objectMapper.writeValueAsString(record),
                    STATE_EXPIRY);
        } catch (RuntimeException exception) {
            throw new IllegalStateException("Unable to store OAuth state", exception);
        }
    }

    private static String generateRandomToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * Generates a PKCE code challenge from a verifier using S256 method.
     */
    private static String generateCodeChallenge(String verifier) {
        try {
            byte[] hash = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(verifier.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate PKCE challenge", e);
        }
    }

    /**
     * Lists of allowed OAuth providers (configured in Keycloak).
     */
    public static final java.util.Set<String> ALLOWED_PROVIDERS = java.util.Set.of("google", "facebook");
}
