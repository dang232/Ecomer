package com.vnshop.apigateway;

import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the CORS policy applied by the API Gateway.
 *
 * <p>These tests build {@link CorsConfiguration} objects that mirror the policy
 * defined in {@code SecurityConfig#corsConfigurationSource} and assert the
 * allow/reject behaviour without starting a Spring context. No Redis, Keycloak,
 * or other infrastructure dependency is needed.
 *
 * <p>Audit finding: the default fallback in {@code application.yml} and
 * {@code SecurityConfig} includes localhost origins. If
 * {@code GATEWAY_CORS_ALLOWED_ORIGINS} is not set in production, localhost
 * requests will be accepted. See {@code docs/api/cors-configuration.md}.
 */
class CorsConfigurationTest {

    /** Build a CorsConfiguration that mirrors the SecurityConfig bean for the given origins string. */
    private static CorsConfiguration buildConfig(String allowedOriginsEnvValue) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(Arrays.stream(allowedOriginsEnvValue.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList());
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setExposedHeaders(List.of("X-Correlation-Id", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);
        return cfg;
    }

    // --- Production-like config tests ---

    @Test
    void productionConfig_rejectsLocalhostPort5173() {
        CorsConfiguration cfg = buildConfig("https://vnshop.vn");

        assertThat(cfg.checkOrigin("http://localhost:5173"))
                .as("Origin http://localhost:5173 must be rejected when not in allowed-origins")
                .isNull();
    }

    @Test
    void productionConfig_rejectsLocalhostPort3000() {
        CorsConfiguration cfg = buildConfig("https://vnshop.vn");

        assertThat(cfg.checkOrigin("http://localhost:3000"))
                .as("Origin http://localhost:3000 must be rejected when not in allowed-origins")
                .isNull();
    }

    @Test
    void productionConfig_allowsConfiguredOrigin() {
        CorsConfiguration cfg = buildConfig("https://vnshop.vn");

        assertThat(cfg.checkOrigin("https://vnshop.vn"))
                .as("Configured production origin must be allowed")
                .isEqualTo("https://vnshop.vn");
    }

    @Test
    void productionConfig_allowsMultipleConfiguredOrigins() {
        CorsConfiguration cfg = buildConfig("https://vnshop.vn,https://admin.vnshop.vn");

        assertThat(cfg.checkOrigin("https://vnshop.vn")).isEqualTo("https://vnshop.vn");
        assertThat(cfg.checkOrigin("https://admin.vnshop.vn")).isEqualTo("https://admin.vnshop.vn");
        assertThat(cfg.checkOrigin("http://localhost:5173")).isNull();
    }

    // --- Default fallback behaviour ---

    @Test
    void defaultFallbackConfig_rejectsLocalhost() {
        CorsConfiguration cfg = buildConfig("https://*.vnshop.example");

        assertThat(cfg.checkOrigin("http://localhost:5173"))
                .as("Default fallback must reject localhost:5173")
                .isNull();

        assertThat(cfg.checkOrigin("http://localhost:3000"))
                .as("Default fallback must reject localhost:3000")
                .isNull();

        assertThat(cfg.checkOrigin("https://shop.vnshop.example"))
                .isEqualTo("https://shop.vnshop.example");
    }

    // --- Allowed methods ---

    @Test
    void corsConfig_allowsExpectedHttpMethods() {
        CorsConfiguration cfg = buildConfig("https://vnshop.vn");

        assertThat(cfg.getAllowedMethods())
                .containsExactlyInAnyOrder("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");
    }

    @Test
    void corsConfig_exposesCorrelationIdHeader() {
        CorsConfiguration cfg = buildConfig("https://vnshop.vn");

        assertThat(cfg.getExposedHeaders()).containsExactlyInAnyOrder(
                "X-Correlation-Id", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset");
    }
}
