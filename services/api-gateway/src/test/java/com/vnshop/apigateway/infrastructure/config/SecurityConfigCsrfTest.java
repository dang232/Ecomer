package com.vnshop.apigateway.infrastructure.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;
import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityConfigCsrfTest {

    @Test
    void gatewayProtectsCookieAuthenticatedStateChangingRequests() {
        ServerHttpSecurity http = ServerHttpSecurity.http();
        http.oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtDecoder(token -> Mono.empty())));
        SecurityWebFilterChain chain = new SecurityConfig()
                .securityWebFilterChain(http);

        assertThat(chain.getWebFilters().collectList().block())
                .anyMatch(filter -> filter.getClass().getSimpleName().contains("Csrf"));
    }
}
