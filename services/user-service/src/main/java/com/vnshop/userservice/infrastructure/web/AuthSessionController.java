package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.AuthSessionUseCase;
import com.vnshop.userservice.application.RefreshTokenRejectedException;
import com.vnshop.userservice.infrastructure.keycloak.KeycloakTokenClient.TokenSet;
import com.vnshop.userservice.infrastructure.web.OAuthLoginState.StateRecord;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;

/**
 * httpOnly-cookie auth surface. Replaces the previous flow where the FE
 * called Keycloak's token endpoint directly and stored both tokens in
 * localStorage. The new contract:
 *
 * <ul>
 *   <li>{@code POST /auth/login} — body {@code {username, password}}.
 *       Sets {@code vnshop_rt} httpOnly cookie carrying the refresh token.
 *       Returns the access token + expiry in the response body so the FE
 *       can keep it in memory.</li>
 *   <li>{@code POST /auth/refresh} — reads the cookie, calls Keycloak's
 *       refresh-token grant, rotates the cookie + returns a fresh access
 *       token. No body required.</li>
 *   <li>{@code POST /auth/logout} — best-effort revoke at Keycloak,
 *       always clears the cookie.</li>
 * </ul>
 *
 * <p>The refresh cookie is {@code HttpOnly} (JS can't read it),
 * {@code SameSite=Strict} (blocks cross-site requests entirely), scoped to
 * {@code /auth}, and {@code Secure} when
 * {@code vnshop.auth.cookie-secure=true} (production). A companion
 * non-httpOnly {@code vnshop_csrf} cookie is issued alongside it so the SPA
 * can implement the double-submit CSRF pattern — see
 * {@link CsrfProtectionFilter}.
 *
 * <p>The access token never sits in {@code localStorage} — XSS can't steal
 * it on a refresh because there's no persistent copy.
 */
@RestController
@RequestMapping("/auth")
public class AuthSessionController {
    public static final String REFRESH_COOKIE_NAME = "vnshop_rt";
    private static final String COOKIE_PATH = "/auth";
    private static final String CSRF_COOKIE_PATH = "/";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    // OAuth configuration
    private static final String DEFAULT_CALLBACK_URL = "http://localhost:8080/auth/oauth/callback";
    private static final Set<String> ALLOWED_PROVIDERS = Set.of("google", "facebook");
    private final AuthSessionUseCase useCase;
    private final OAuthLoginState oauthState;
    private final boolean cookieSecure;
    private final String cookieSameSite;
    private final String callbackBaseUrl;
    private final String keycloakAuthorizationUrl;
    private final String frontendBaseUrl;

    public AuthSessionController(
            AuthSessionUseCase useCase,
            OAuthLoginState oauthState,
            @Value("${vnshop.auth.cookie-secure:false}") boolean cookieSecure,
            @Value("${vnshop.auth.cookie-same-site:Strict}") String cookieSameSite,
            @Value("${vnshop.auth.callback-base-url:}") String callbackBaseUrl,
            @Value("${keycloak.public-base-url:http://localhost:8080}") String keycloakPublicBaseUrl,
            @Value("${vnshop.auth.frontend-base-url:http://localhost:3000}") String frontendBaseUrl) {
        this.useCase = useCase;
        this.oauthState = oauthState;
        this.cookieSecure = cookieSecure;
        this.cookieSameSite = cookieSameSite;
        this.callbackBaseUrl = (callbackBaseUrl != null && !callbackBaseUrl.isBlank()) ? callbackBaseUrl : DEFAULT_CALLBACK_URL;
        this.keycloakAuthorizationUrl = stripTrailingSlash(keycloakPublicBaseUrl)
                + "/realms/vnshop/protocol/openid-connect/auth";
        this.frontendBaseUrl = normalizeFrontendBaseUrl(frontendBaseUrl);
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        TokenSet tokens = useCase.login(request.username(), request.password());
        String csrfToken = generateCsrfToken();
        writeRefreshCookie(response, tokens.refreshToken(), tokens.refreshExpiresIn());
        writeCsrfCookie(response, csrfToken, tokens.refreshExpiresIn());
        return ApiResponse.ok(new LoginResponse(tokens.accessToken(), tokens.accessExpiresIn()));
    }

    @PostMapping("/refresh")
    public ApiResponse<LoginResponse> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = readRefreshCookie(request);
        TokenSet tokens;
        try {
            tokens = useCase.refresh(refreshToken);
        } catch (RefreshTokenRejectedException e) {
            // Keycloak rejected the refresh token (expired, revoked, etc.) —
            // clear both cookies so the FE knows to bounce to /login on the
            // next 401 instead of looping on /auth/refresh.
            clearRefreshCookie(response);
            clearCsrfCookie(response);
            throw e;
        }
        String csrfToken = generateCsrfToken();
        writeRefreshCookie(response, tokens.refreshToken(), tokens.refreshExpiresIn());
        writeCsrfCookie(response, csrfToken, tokens.refreshExpiresIn());
        return ApiResponse.ok(new LoginResponse(tokens.accessToken(), tokens.accessExpiresIn()));
    }

    @PostMapping("/logout")
    public ApiResponse<LogoutResponse> logout(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = readRefreshCookie(request);
        useCase.logout(refreshToken);
        clearRefreshCookie(response);
        clearCsrfCookie(response);
        return ApiResponse.ok(new LogoutResponse(true));
    }

    /**
     * Initiates OAuth flow with Keycloak broker.
     * Redirects to Keycloak authorization endpoint with kc_idp_hint for the specified provider.
     */
    @GetMapping("/oauth/{provider}/start")
    public void oauthStart(
            @PathVariable String provider,
            @RequestParam(name = "next", required = false, defaultValue = "/") String nextParam,
            HttpServletResponse response) throws Exception {

        // Validate provider
        if (provider == null || provider.isBlank() || !ALLOWED_PROVIDERS.contains(provider.toLowerCase())) {
            response.sendRedirect(buildFrontendRedirect("/login?oauthError=unknown_provider"));
            return;
        }

        // Sanitize and validate the return path
        String sanitizedReturn = sanitizeReturnPath(nextParam);
        // Create state with PKCE
        OAuthLoginState.StateWithChallenge stateWithChallenge =
                oauthState.createStateWithChallenge(provider.toLowerCase(), sanitizedReturn);

        // Build authorization URL with PKCE
        StringBuilder authUrl = new StringBuilder(keycloakAuthorizationUrl);
        authUrl.append("?client_id=vnshop-api");
        authUrl.append("&response_type=code");
        authUrl.append("&scope=openid profile email");
        authUrl.append("&state=").append(stateWithChallenge.state());
        authUrl.append("&kc_idp_hint=").append(provider.toLowerCase());

        // Add PKCE parameters
        authUrl.append("&code_challenge=").append(stateWithChallenge.codeChallenge());
        authUrl.append("&code_challenge_method=S256");

        // The callback is server-owned so callers cannot select an arbitrary token-exchange URI.
        authUrl.append("&redirect_uri=").append(java.net.URLEncoder.encode(callbackBaseUrl, StandardCharsets.UTF_8.name()));

        response.sendRedirect(authUrl.toString());
    }

    /**
     * OAuth callback from Keycloak broker.
     * Exchanges authorization code for tokens and sets cookies.
     */
    @GetMapping("/oauth/callback")
    public void oauthCallback(
            @RequestParam(name = "code", required = false) String code,
            @RequestParam(name = "state", required = false) String state,
            @RequestParam(name = "error", required = false) String error,
            HttpServletResponse response) throws Exception {

        // Check for OAuth error from Keycloak
        if (error != null) {
            response.sendRedirect(buildFrontendRedirect("/login?oauthError=oauth_failed"));
            return;
        }

        // Validate required parameters
        if (code == null || code.isBlank() || state == null || state.isBlank()) {
            response.sendRedirect(buildFrontendRedirect("/login?oauthError=missing_params"));
            return;
        }

        // Consume and validate state
        StateRecord stateRecord = oauthState.consumeState(state);
        if (stateRecord == null) {
            response.sendRedirect(buildFrontendRedirect("/login?oauthError=invalid_state"));
            return;
        }

        try {
            // Exchange code for tokens
            String codeVerifier = oauthState.getCodeVerifier(stateRecord);
            String callbackUrl = callbackBaseUrl;

            TokenSet tokens = useCase.exchangeCodeForTokens(code, codeVerifier, callbackUrl);

            // Issue cookies (same as regular login)
            String csrfToken = generateCsrfToken();
            writeRefreshCookie(response, tokens.refreshToken(), tokens.refreshExpiresIn());
            writeCsrfCookie(response, csrfToken, tokens.refreshExpiresIn());

            // Redirect to the requested path on the SPA
            String returnTo = stateRecord.returnTo();
            if (returnTo == null || returnTo.isBlank() || !isSafeReturnPath(returnTo)) {
                returnTo = "/";
            }
            response.sendRedirect(buildFrontendRedirect(returnTo));

        } catch (Exception e) {
            // Log the error but don't expose details to client
            // Redirect to login with generic error
            response.sendRedirect(buildFrontendRedirect("/login?oauthError=exchange_failed"));
        }
    }

    /**
     * Sanitizes the return path to prevent open redirect vulnerabilities.
     * Only allows relative SPA paths starting with /, rejects protocol-relative //.
     */
    private static String sanitizeReturnPath(String path) {
        if (path == null || path.isBlank()) {
            return "/";
        }
        String candidate = path.trim();
        if (!isSafeReturnPath(candidate)) {
            return "/";
        }
        return candidate;
    }

    /**
     * Checks if a return path is safe for redirect.
     */
    private static boolean isSafeReturnPath(String path) {
        if (path == null || path.isBlank()) {
            return false;
        }

        return path.startsWith("/")
                && !path.startsWith("//")
                && path.indexOf('\\') < 0
                && path.indexOf('\r') < 0
                && path.indexOf('\n') < 0;
    }

    /**
     * Builds the full redirect URL by combining the frontend base URL with the
     * given path. This ensures OAuth callbacks always land on the SPA, not the
     * API gateway.
     */
    private String buildFrontendRedirect(String path) {
        return frontendBaseUrl + sanitizeReturnPath(path);
    }

    private void writeRefreshCookie(HttpServletResponse response, String value, int maxAgeSeconds) {
        // Servlet API's Cookie class doesn't expose SameSite, so we compose
        // the Set-Cookie header manually for the SameSite + correct Path
        // semantics. Spring's ResponseCookie would also work but adding
        // org.springframework.http imports here is overkill for one header.
        StringBuilder sb = new StringBuilder();
        sb.append(REFRESH_COOKIE_NAME).append('=').append(value);
        sb.append("; Path=").append(COOKIE_PATH);
        sb.append("; HttpOnly");
        sb.append("; SameSite=").append(cookieSameSite);
        if (cookieSecure) sb.append("; Secure");
        if (maxAgeSeconds > 0) sb.append("; Max-Age=").append(maxAgeSeconds);
        response.addHeader("Set-Cookie", sb.toString());
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        StringBuilder sb = new StringBuilder();
        sb.append(REFRESH_COOKIE_NAME).append('=');
        sb.append("; Path=").append(COOKIE_PATH);
        sb.append("; HttpOnly");
        sb.append("; SameSite=").append(cookieSameSite);
        if (cookieSecure) sb.append("; Secure");
        sb.append("; Max-Age=0");
        response.addHeader("Set-Cookie", sb.toString());
    }

    /**
     * Writes a non-httpOnly CSRF cookie that the SPA can read via
     * {@code document.cookie} and echo back in the {@code X-CSRF-Token} header.
     * It must be scoped to {@code /} so JavaScript running on every SPA route
     * can read it before sending an auth refresh or logout request. The httpOnly
     * refresh-token cookie remains scoped to {@code /auth}.
     */
    private void writeCsrfCookie(HttpServletResponse response, String token, int maxAgeSeconds) {
        StringBuilder sb = new StringBuilder();
        sb.append(CsrfProtectionFilter.CSRF_COOKIE_NAME).append('=').append(token);
        sb.append("; Path=").append(CSRF_COOKIE_PATH);
        // Intentionally NOT HttpOnly — the SPA must be able to read this value.
        sb.append("; SameSite=").append(cookieSameSite);
        if (cookieSecure) sb.append("; Secure");
        if (maxAgeSeconds > 0) sb.append("; Max-Age=").append(maxAgeSeconds);
        response.addHeader("Set-Cookie", sb.toString());
    }

    private void clearCsrfCookie(HttpServletResponse response) {
        StringBuilder sb = new StringBuilder();
        sb.append(CsrfProtectionFilter.CSRF_COOKIE_NAME).append('=');
        sb.append("; Path=").append(CSRF_COOKIE_PATH);
        sb.append("; SameSite=").append(cookieSameSite);
        if (cookieSecure) sb.append("; Secure");
        sb.append("; Max-Age=0");
        response.addHeader("Set-Cookie", sb.toString());
    }

    private static String generateCsrfToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String stripTrailingSlash(String url) {
        if (url == null || url.isBlank()) {
            return "http://localhost:8085";
        }
        return url.replaceFirst("/+$", "");
    }

    private static String normalizeFrontendBaseUrl(String url) {
        if (url == null || url.isBlank()) {
            return "http://localhost:3000";
        }
        return url.replaceFirst("/+$", "");
    }

    private static String readRefreshCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if (REFRESH_COOKIE_NAME.equals(cookie.getName())) {
                String value = cookie.getValue();
                return (value == null || value.isBlank()) ? null : value;
            }
        }
        return null;
    }
}
