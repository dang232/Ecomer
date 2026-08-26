package com.vnshop.apigateway.infrastructure.filter;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

class LegacyApiVersioningFilterTest {
    @Test
    void redirectsLegacyMutationWithTemporaryRedirectAndMigrationHeaders() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.post("/orders?cursor=next")
                .body("{\"items\":[]}"));
        var filter = new LegacyApiVersioningFilter("https://api.vnshop.example", "2026-11-23T00:00:00Z");

        filter.filter(exchange, ignored -> Mono.error(new AssertionError("legacy request was proxied"))).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.TEMPORARY_REDIRECT);
        assertThat(exchange.getResponse().getHeaders().getLocation()).hasToString(
                "https://api.vnshop.example/api/v1/orders?cursor=next");
        assertThat(exchange.getResponse().getHeaders().getFirst("Deprecation")).isEqualTo("true");
        assertThat(exchange.getResponse().getHeaders().getFirst("Sunset")).isEqualTo("Mon, 23 Nov 2026 00:00:00 GMT");
        assertThat(exchange.getResponse().getHeaders().getFirst("Link"))
                .contains("rel=\"successor-version\"");
    }

    @Test
    void preservesLegacyPostMethodAndBodyWhenRedirecting() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.post("/orders")
                .header("Content-Type", "application/json")
                .body("{\"items\":[{\"productId\":\"p-1\",\"quantity\":2}]}"));
        var filter = new LegacyApiVersioningFilter("https://api.vnshop.example", "2026-11-23T00:00:00Z");
        filter.filter(exchange, ignored -> Mono.error(new AssertionError("legacy request was proxied"))).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.TEMPORARY_REDIRECT);
        assertThat(exchange.getRequest().getMethod()).isEqualTo(org.springframework.http.HttpMethod.POST);
        assertThat(exchange.getRequest().getHeaders().getFirst("Content-Type")).isEqualTo("application/json");
        String body = DataBufferUtils.join(exchange.getRequest().getBody()).map(buffer -> {
            try {
                return StandardCharsets.UTF_8.decode(buffer.asByteBuffer()).toString();
            } finally {
                DataBufferUtils.release(buffer);
            }
        }).block();
        assertThat(body).isEqualTo("{\"items\":[{\"productId\":\"p-1\",\"quantity\":2}]}");
    }

    @Test
    void redirectsLegacyReadWithPermanentRedirectAndMigrationHeaders() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/products").build());
        var filter = new LegacyApiVersioningFilter("https://api.vnshop.example", "2026-11-23T00:00:00Z");

        filter.filter(exchange, ignored -> Mono.error(new AssertionError("legacy request was proxied"))).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.PERMANENT_REDIRECT);
        assertThat(exchange.getResponse().getHeaders().getLocation()).hasToString(
                "https://api.vnshop.example/api/v1/products");
        assertThat(exchange.getResponse().getHeaders().getFirst("Deprecation")).isEqualTo("true");
        assertThat(exchange.getResponse().getHeaders().getFirst("Sunset")).isEqualTo("Mon, 23 Nov 2026 00:00:00 GMT");
    }

    @Test
    void doesNotRedirectCanonicalOrExcludedPaths() {
        var filter = new LegacyApiVersioningFilter("https://api.vnshop.example", "2026-11-23T00:00:00Z");
        var canonical = MockServerWebExchange.from(MockServerHttpRequest.get("/api/v1/orders").build());
        var websocket = MockServerWebExchange.from(MockServerHttpRequest.get("/ws/messaging").build());

        filter.filter(canonical, exchange -> exchange.getResponse().setComplete()).block();
        filter.filter(websocket, exchange -> exchange.getResponse().setComplete()).block();

        assertThat(canonical.getResponse().getStatusCode()).isNull();
        assertThat(websocket.getResponse().getStatusCode()).isNull();
    }

    @Test
    void respectsRouteAndPrefixBoundaries() {
        var filter = new LegacyApiVersioningFilter("https://api.vnshop.example", "2026-11-23T00:00:00Z");
        var unsupportedSellerPath = MockServerWebExchange.from(MockServerHttpRequest.get("/seller/unknown").build());
        var similarlyNamedProductPath = MockServerWebExchange.from(MockServerHttpRequest.get("/products-extra/item").build());
        var sellerOrderPath = MockServerWebExchange.from(MockServerHttpRequest.get("/seller/orders/123").build());

        filter.filter(unsupportedSellerPath, exchange -> exchange.getResponse().setComplete()).block();
        filter.filter(similarlyNamedProductPath, exchange -> exchange.getResponse().setComplete()).block();
        filter.filter(sellerOrderPath, ignored -> Mono.error(new AssertionError("seller order was proxied"))).block();

        assertThat(unsupportedSellerPath.getResponse().getStatusCode()).isNull();
        assertThat(similarlyNamedProductPath.getResponse().getStatusCode()).isNull();
        assertThat(sellerOrderPath.getResponse().getStatusCode()).isEqualTo(HttpStatus.PERMANENT_REDIRECT);
    }
}
