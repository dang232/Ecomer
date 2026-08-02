package com.vnshop.apigateway.infrastructure.config;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.WebFilterChainProxy;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

class SecurityConfigWebSocketAuthorizationTest {

    private WebTestClient client;

    @BeforeEach
    void setUp() {
        ServerHttpSecurity http = ServerHttpSecurity.http();
        http.oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtDecoder(token -> Mono.empty())));
        SecurityWebFilterChain chain = new SecurityConfig().securityWebFilterChain(http);

        client = WebTestClient.bindToWebHandler(exchange -> {
                    exchange.getResponse().setStatusCode(HttpStatus.NO_CONTENT);
                    return exchange.getResponse().setComplete();
                })
                .webFilter(new WebFilterChainProxy(List.of(chain)))
                .build();
    }

    @Test
    void permitsUnauthenticatedNotificationEngineIoUpgrade() {
        client.get()
                .uri("/ws/notifications/?EIO=4&transport=websocket")
                .exchange()
                .expectStatus().isNoContent();
    }

    @Test
    void keepsNotificationRestAndOtherWebSocketPathsAuthenticated() {
        client.get()
                .uri("/notifications")
                .exchange()
                .expectStatus().isUnauthorized();

        client.get()
                .uri("/ws/private/?EIO=4&transport=websocket")
                .exchange()
                .expectStatus().isUnauthorized();
    }
}
