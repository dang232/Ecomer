package com.vnshop.apigateway.infrastructure.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.config.annotation.method.configuration.EnableReactiveMethodSecurity;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import reactor.core.publisher.Mono;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Configuration
@EnableWebFluxSecurity
@EnableReactiveMethodSecurity
public class SecurityConfig {

    /**
     * Define an explicit reactive CORS configuration source so Spring
     * Security WebFlux's `.cors(withDefaults())` finds it on the chain. The
     * Spring Cloud Gateway `globalcors` YAML configures a CorsWebFilter but
     * doesn't expose a CorsConfigurationSource bean, so the security chain
     * answers OPTIONS preflights without any Access-Control-* headers.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${spring.cloud.gateway.globalcors.cors-configurations.[/**].allowed-origins:http://localhost:3000,http://localhost:5173}")
                    String allowedOrigins) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList());
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setExposedHeaders(List.of("X-Correlation-Id"));
        // Cookie-based auth (vnshop_rt refresh-token cookie issued by
        // user-service /auth/login) requires the browser to include
        // credentials on cross-origin requests. Concrete allowed-origins
        // list above keeps this safe — wildcards + credentials would be
        // rejected by the browser.
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    @Bean
    SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
        return http
            // Without an explicit .cors(...) call, Spring Security WebFlux
            // intercepts OPTIONS preflights and emits a bare 200 with no
            // Access-Control-* headers, even though Spring Cloud Gateway's
            // globalcors config wires up a CorsWebFilter. Wiring CORS into
            // the security chain explicitly makes that filter contribute
            // its headers before the chain finishes.
            .cors(org.springframework.security.config.Customizer.withDefaults())
            .csrf(csrf -> csrf.disable())
            .authorizeExchange(exchanges -> exchanges
                // Browsers send a no-auth OPTIONS preflight before any
                // cross-origin POST/PUT — permit it on every path so the
                // CORS filter has a chance to respond with allow-origin.
                .pathMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .pathMatchers(HttpMethod.GET, "/products/**", "/categories/**", "/search/**",
                        "/reviews/**", "/questions/**", "/recommendations/**", "/health",
                        "/api/config", "/api/config/public", "/sellers", "/sellers/*", "/flash-sale/active",
                        "/payment/methods", "/coupons").permitAll()
                .pathMatchers(HttpMethod.POST, "/reviews/seller-summaries", "/products/counts",
                        "/coupons/validate", "/checkout/validate-coupon").permitAll()
                .pathMatchers("/auth/**", "/payment/*/callback", "/payment/*/ipn", "/payment/stripe/webhook").permitAll()
                // The WebSocket handshake on /ws/messaging carries the JWT through
                // a subprotocol because browsers can't set Authorization headers on
                // `new WebSocket(...)`, so it cannot pass the gateway's resource
                // server filter. The downstream messaging-service verifies the
                // token itself via WsJwtVerifier before binding the socket to a user.
                // A query-token fallback remains in that service for older clients.
                .pathMatchers("/ws/messaging").permitAll()
                .pathMatchers("/actuator/health", "/actuator/info", "/actuator/prometheus").permitAll()
                // ponytail: glob permits /<any>/actuator/health for downstream services — FE admin health checks carry no token
                .pathMatchers("/" + "*/actuator/health", "/" + "*/actuator/info").permitAll()
                .pathMatchers("/notification-service/health").permitAll()
                .pathMatchers("/monitoring/**").hasRole("ADMIN")
                .pathMatchers("/admin/**").hasRole("ADMIN")
                .pathMatchers("/seller/**", "/sellers/me/**").hasRole("SELLER")
                .anyExchange().authenticated()
            )
            // The SPA acquires tokens directly from Keycloak (PKCE) and sends them as Bearer.
            // No oauth2Login (no client registration) — gateway is purely a JWT-validating proxy.
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
            )
            .headers(headers -> headers
                .frameOptions(frame -> frame.mode(org.springframework.security.web.server.header.XFrameOptionsServerHttpHeadersWriter.Mode.DENY))
                .contentTypeOptions(org.springframework.security.config.Customizer.withDefaults())
                .cache(org.springframework.security.config.Customizer.withDefaults())
                .contentSecurityPolicy(csp -> csp.policyDirectives(
                    "default-src 'self'; " +
                    "script-src 'self' https://js.stripe.com https://www.paypal.com; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data: https://*.r2.dev; " +
                    "connect-src 'self' wss: https://api.stripe.com https://www.paypal.com; " +
                    "frame-src https://js.stripe.com https://www.paypal.com; " +
                    "font-src 'self'; " +
                    "object-src 'none'; " +
                    "base-uri 'self'; " +
                    "form-action 'self'; " +
                    "frame-ancestors 'none'; " +
                    "upgrade-insecure-requests"
                ))
                .referrerPolicy(referrer -> referrer.policy(
                    org.springframework.security.web.server.header.ReferrerPolicyServerHttpHeadersWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                .permissionsPolicy(permissions -> permissions.policy(
                    "camera=(), microphone=(), geolocation=()"))
            )
            .build();
    }

    @Bean
    Converter<Jwt, Mono<AbstractAuthenticationToken>> jwtAuthenticationConverter() {
        return new ReactiveJwtAuthenticationConverterAdapter(jwt -> {
            Collection<GrantedAuthority> authorities = Stream.concat(
                    realmRoles(jwt).stream(),
                    scopeAuthorities(jwt).stream()
                )
                .collect(Collectors.toSet());
            return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
        });
    }

    private Collection<GrantedAuthority> realmRoles(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
        if (realmAccess == null || !(realmAccess.get("roles") instanceof Collection<?> roles)) {
            return List.of();
        }
        return roles.stream()
            .filter(String.class::isInstance)
            .map(String.class::cast)
            .map(role -> role.startsWith("ROLE_") ? role.toUpperCase() : ("ROLE_" + role).toUpperCase())
            .map(SimpleGrantedAuthority::new)
            .collect(Collectors.toSet());
    }

    private Collection<GrantedAuthority> scopeAuthorities(Jwt jwt) {
        String scope = jwt.getClaimAsString("scope");
        if (scope == null || scope.isBlank()) {
            return List.of();
        }
        return Stream.of(scope.split(" "))
            .filter(value -> !value.isBlank())
            .map(value -> new SimpleGrantedAuthority("SCOPE_" + value))
            .collect(Collectors.toSet());
    }
}
