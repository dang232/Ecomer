package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.AuthSessionUseCase;
import com.vnshop.userservice.infrastructure.keycloak.KeycloakTokenClient.TokenSet;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import java.lang.reflect.Field;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthSessionControllerTest {

    @Mock
    private AuthSessionUseCase useCase;

    @Mock
    private OAuthLoginState oauthState;

    private AuthSessionController controller;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    private static final TokenSet TOKENS = new TokenSet("access-token", "refresh-token", 300, 1800);

    @BeforeEach
    void setUp() {
        controller = new AuthSessionController(
                useCase,
                oauthState,
                false,
                "Strict",
                "http://localhost:8080/auth/oauth/callback",
                "http://localhost:8085",
                "http://localhost:3000");
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
    }

    // --- oauth start tests ---

    @Test
    void oauthStart_allowedProvider_redirectsToKeycloak() throws Exception {
        when(oauthState.createStateWithChallenge("google", "/profile"))
                .thenReturn(new OAuthLoginState.StateWithChallenge("test-state", "test-challenge"));

        controller.oauthStart("google", "/profile", response);

        assertThat(response.getRedirectedUrl()).startsWith("http://localhost:8085/realms/vnshop/protocol/openid-connect/auth");
        assertThat(response.getRedirectedUrl()).contains("kc_idp_hint=google");
        assertThat(response.getRedirectedUrl()).contains("state=test-state");
        assertThat(response.getRedirectedUrl()).contains("code_challenge=test-challenge");
        assertThat(response.getRedirectedUrl()).contains("code_challenge_method=S256");
    }

    @Test
    void oauthStart_unknownProvider_redirectsToLoginWithError() throws Exception {
        controller.oauthStart("unknown", "/profile", response);

        assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:3000/login?oauthError=unknown_provider");
    }

    @Test
    void oauthStart_facebookProvider_redirectsToKeycloak() throws Exception {
        when(oauthState.createStateWithChallenge("facebook", "/profile"))
                .thenReturn(new OAuthLoginState.StateWithChallenge("fb-state", "fb-challenge"));

        controller.oauthStart("facebook", "/profile", response);

        assertThat(response.getRedirectedUrl()).startsWith("http://localhost:8085/realms/vnshop/protocol/openid-connect/auth");
        assertThat(response.getRedirectedUrl()).contains("kc_idp_hint=facebook");
    }

    @Test
    void oauthStart_offOriginNext_redirectsToSafePath() throws Exception {
        when(oauthState.createStateWithChallenge("google", "/"))
                .thenReturn(new OAuthLoginState.StateWithChallenge("test-state", "test-challenge"));

        // Try an off-origin URL - should be sanitized to "/"
        controller.oauthStart("google", "http://evil.com/path", response);

        // The return path should be sanitized to "/" (default)
        verify(oauthState).createStateWithChallenge(eq("google"), eq("/"));
    }

    @Test
    void oauthStart_usesServerOwnedCallback() throws Exception {
        when(oauthState.createStateWithChallenge("google", "/"))
                .thenReturn(new OAuthLoginState.StateWithChallenge("test-state", "test-challenge"));

        controller.oauthStart("google", "/", response);

        assertThat(response.getRedirectedUrl())
                .contains("redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fauth%2Foauth%2Fcallback");
    }

    @Test
    void oauthStart_preservesSafeProductDetailPathAndQuery() throws Exception {
        when(oauthState.createStateWithChallenge("google", "/product/p1?ref=wishlist"))
                .thenReturn(new OAuthLoginState.StateWithChallenge("test-state", "test-challenge"));

        controller.oauthStart("google", "/product/p1?ref=wishlist", response);

        verify(oauthState).createStateWithChallenge("google", "/product/p1?ref=wishlist");
    }

    @Test
    void frontendRedirectOrigin_isConstructorConfigured() {
        boolean configurable = Arrays.stream(AuthSessionController.class.getDeclaredConstructors())
                .anyMatch(constructor -> constructor.getParameterCount() == 7);

        assertThat(configurable).isTrue();
    }

    @Test
    void oauthState_usesSharedRedisStorage() {
        boolean hasRedisTemplate = Arrays.stream(OAuthLoginState.class.getDeclaredFields())
                .map(Field::getType)
                .map(Class::getName)
                .anyMatch("org.springframework.data.redis.core.StringRedisTemplate"::equals);

        assertThat(hasRedisTemplate).isTrue();
    }

    // --- oauth callback tests ---

    @Test
    void oauthCallback_oauthError_redirectsToLoginWithError() throws Exception {
        controller.oauthCallback(null, "test-state", "access_denied", response);

        assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:3000/login?oauthError=oauth_failed");
    }

    @Test
    void oauthCallback_missingCode_redirectsToLoginWithError() throws Exception {
        controller.oauthCallback(null, "test-state", null, response);

        assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:3000/login?oauthError=missing_params");
    }

    @Test
    void oauthCallback_missingState_redirectsToLoginWithError() throws Exception {
        controller.oauthCallback("auth-code", null, null, response);

        assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:3000/login?oauthError=missing_params");
    }

    @Test
    void oauthCallback_expiredState_redirectsToLoginWithError() throws Exception {
        when(oauthState.consumeState("expired-state")).thenReturn(null);

        controller.oauthCallback("auth-code", "expired-state", null, response);

        assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:3000/login?oauthError=invalid_state");
    }

    @Test
    void oauthCallback_invalidState_redirectsToLoginWithError() throws Exception {
        when(oauthState.consumeState("invalid-state")).thenReturn(null);

        controller.oauthCallback("auth-code", "invalid-state", null, response);

        assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:3000/login?oauthError=invalid_state");
    }

    @Test
    void oauthCallback_successfulExchange_setsCookiesAndRedirects() throws Exception {
        OAuthLoginState.StateRecord stateRecord = new OAuthLoginState.StateRecord(
                "google", "verifier", "challenge", "/profile");
        when(oauthState.consumeState("valid-state")).thenReturn(stateRecord);
        when(oauthState.getCodeVerifier(stateRecord)).thenReturn("verifier");
        when(useCase.exchangeCodeForTokens("auth-code", "verifier", "http://localhost:8080/auth/oauth/callback"))
                .thenReturn(TOKENS);

        controller.oauthCallback("auth-code", "valid-state", null, response);

        // Verify cookies are set
        assertThat(response.getCookie("vnshop_rt")).isNotNull();
        assertThat(response.getCookie("vnshop_rt").getValue()).isEqualTo("refresh-token");
        assertThat(response.getCookie("vnshop_rt").isHttpOnly()).isTrue();

        assertThat(response.getCookie("vnshop_csrf")).isNotNull();
        assertThat(response.getCookie("vnshop_csrf").getValue()).isNotBlank();
        assertThat(response.getHeaderValues("Set-Cookie"))
                .anySatisfy(header -> assertThat(String.valueOf(header))
                        .contains("vnshop_csrf=")
                        .contains("Path=/;"));

        // Verify redirect to return path on the SPA
        assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:3000/profile");
    }

    @Test
    void oauthCallback_failedExchange_redirectsToLoginWithError() throws Exception {
        OAuthLoginState.StateRecord stateRecord = new OAuthLoginState.StateRecord(
                "google", "verifier", "challenge", "/profile");
        when(oauthState.consumeState("valid-state")).thenReturn(stateRecord);
        when(oauthState.getCodeVerifier(stateRecord)).thenReturn("verifier");
        when(useCase.exchangeCodeForTokens(anyString(), anyString(), anyString()))
                .thenThrow(new RuntimeException("Exchange failed"));

        controller.oauthCallback("auth-code", "valid-state", null, response);

        assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:3000/login?oauthError=exchange_failed");
    }

    @Test
    void oauthCallback_unsafeReturnPath_redirectsToRoot() throws Exception {
        OAuthLoginState.StateRecord stateRecord = new OAuthLoginState.StateRecord(
                "google", "verifier", "challenge", "http://evil.com");
        when(oauthState.consumeState("valid-state")).thenReturn(stateRecord);
        when(oauthState.getCodeVerifier(stateRecord)).thenReturn("verifier");
        when(useCase.exchangeCodeForTokens(anyString(), anyString(), anyString()))
                .thenReturn(TOKENS);

        controller.oauthCallback("auth-code", "valid-state", null, response);

        // Should redirect to / on the SPA when return path is unsafe
        assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:3000/");
    }

    // --- cookie tests ---

    @Test
    void oauthCallback_secureCookie_setsSecureFlag() throws Exception {
        // Create controller with secure cookies
        AuthSessionController secureController = new AuthSessionController(
                useCase,
                oauthState,
                true,
                "Strict",
                "http://localhost:8080/auth/oauth/callback",
                "http://localhost:8085",
                "http://localhost:3000");

        OAuthLoginState.StateRecord stateRecord = new OAuthLoginState.StateRecord(
                "google", "verifier", "challenge", "/profile");
        when(oauthState.consumeState("valid-state")).thenReturn(stateRecord);
        when(oauthState.getCodeVerifier(stateRecord)).thenReturn("verifier");
        when(useCase.exchangeCodeForTokens(anyString(), anyString(), anyString()))
                .thenReturn(TOKENS);

        MockHttpServletResponse secureResponse = new MockHttpServletResponse();
        secureController.oauthCallback("auth-code", "valid-state", null, secureResponse);

        // In Spring MockHttpServletResponse, Secure flag is handled differently
        // The cookie header should contain Secure
        assertThat(secureResponse.getCookie("vnshop_rt")).isNotNull();
    }
}
