package com.vnshop.apigateway.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.junit.jupiter.api.Test;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpCookie;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatcher;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.WebFilterChainProxy;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

class SecurityConfigMinioTest {
    @Test
    void cookieAuthenticatedPutToPublicObjectsIsNotCsrfProtected() throws Exception {
        Method method = SecurityConfig.class.getDeclaredMethod("requiresCsrfProtection", org.springframework.web.server.ServerWebExchange.class);
        method.setAccessible(true);
        SecurityConfig config = new SecurityConfig(new PublicBucketProperties("avatars-custom", "products-custom", "reviews-custom", "videos-custom"));
        for (String prefix : List.of("avatars-custom", "products-custom", "reviews-custom", "videos-custom")) {
            var exchange = MockServerWebExchange.from(MockServerHttpRequest.method(HttpMethod.PUT, "/" + prefix + "/u/a.jpg")
                    .cookie(new HttpCookie("vnshop_rt", "refresh-token"))
                    .build());
            assertThat(((reactor.core.publisher.Mono<ServerWebExchangeMatcher.MatchResult>) method.invoke(config, exchange))
                    .block().isMatch()).isFalse();
        }
        var oldBucket = MockServerWebExchange.from(MockServerHttpRequest.put("/vnshop-avatars/u/a.jpg")
                .cookie(new HttpCookie("vnshop_rt", "refresh-token")).build());
        assertThat(((reactor.core.publisher.Mono<ServerWebExchangeMatcher.MatchResult>) method.invoke(config, oldBucket))
                .block().isMatch()).isTrue();
    }

    @Test
    void cookieAuthenticatedPutToProtectedEndpointRequiresCsrf() throws Exception {
        Method method = SecurityConfig.class.getDeclaredMethod("requiresCsrfProtection", org.springframework.web.server.ServerWebExchange.class);
        method.setAccessible(true);
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.put("/sellers/me/products")
                .cookie(new HttpCookie("vnshop_rt", "refresh-token"))
                .build());

        assertThat(((reactor.core.publisher.Mono<ServerWebExchangeMatcher.MatchResult>) method.invoke(
                new SecurityConfig(PublicBucketProperties.defaults()), exchange))
                .block().isMatch()).isTrue();
    }

    @Test
    void customPublicBucketsAllowOnlyGetAndHeadWhilePutRequiresPresigning() {
        PublicBucketProperties buckets = new PublicBucketProperties("avatars-custom", "products-custom", "reviews-custom", "videos-custom");
        WebTestClient client = client(new SecurityConfig(buckets));
        for (String bucket : List.of("avatars-custom", "products-custom", "reviews-custom", "videos-custom")) {
            client.get().uri("/" + bucket + "/object").exchange().expectStatus().isNoContent();
            client.head().uri("/" + bucket + "/object").exchange().expectStatus().isNoContent();
            client.put().uri("/" + bucket + "/object").exchange().expectStatus().isUnauthorized();
            client.put().uri("/" + bucket + "/object?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=test&X-Amz-Date=20260825T000000Z&X-Amz-Expires=300&X-Amz-SignedHeaders=host&X-Amz-Signature=test")
                    .exchange().expectStatus().isNoContent();
            client.post().uri("/" + bucket + "/object").exchange().expectStatus().isUnauthorized();
        }
        client.get().uri("/private-staging/object").exchange().expectStatus().isUnauthorized();
        client.get().uri("/vnshop-avatars/object").exchange().expectStatus().isUnauthorized();
    }

    private static WebTestClient client(SecurityConfig config) {
        ServerHttpSecurity http = ServerHttpSecurity.http();
        http.oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtDecoder(token -> Mono.empty())));
        SecurityWebFilterChain chain = config.securityWebFilterChain(http, new ObjectMapper());
        return WebTestClient.bindToWebHandler(exchange -> {
                    exchange.getResponse().setStatusCode(HttpStatus.NO_CONTENT);
                    return exchange.getResponse().setComplete();
                })
                .webFilter(new WebFilterChainProxy(List.of(chain)))
                .build();
    }
}
