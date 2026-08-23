package com.vnshop.apigateway.infrastructure.config;

import java.util.List;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.WebFilterChainProxy;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

class SecurityConfigWebSocketAuthorizationTest {

    private WebTestClient client;

    @BeforeEach
    void setUp() {
        ServerHttpSecurity http = ServerHttpSecurity.http();
        http.oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtDecoder(token -> Mono.empty())));
        SecurityWebFilterChain chain = new SecurityConfig(PublicBucketProperties.defaults()).securityWebFilterChain(http);

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

    @Test
    void permitsOnlyThePublicVideoCollectionRead() {
        client.get()
                .uri("/videos?entityId=product-1&context=PRODUCT")
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/videos/video-1/status")
                .exchange()
                .expectStatus().isUnauthorized();

        client.post()
                .uri("/videos/upload")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void exposesTusUploadHeadersToBrowserClients() {
        var source = new SecurityConfig(PublicBucketProperties.defaults()).corsConfigurationSource("http://localhost:3000");
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.options("/videos/upload")
                        .header("Origin", "http://localhost:3000"));

        var cors = source.getCorsConfiguration(exchange);

        Assertions.assertNotNull(cors);
        Assertions.assertTrue(cors.getExposedHeaders().containsAll(
                List.of("Location", "Tus-Resumable", "Upload-Offset", "X-Correlation-Id")));
    }

    @Test
    void permitsLoginWhenAStaleRefreshCookieIsPresent() {
        client.post()
                .uri("/auth/login")
                .cookie("vnshop_rt", "stale-refresh-token")
                .exchange()
                .expectStatus().isNoContent();
    }
}
