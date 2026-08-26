package com.vnshop.apigateway.infrastructure.filter;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;

class RateLimitHeadersFilterTest {

    @Test
    void emitsStandardHeadersForRateLimitedResponse() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/products").build());
        exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
        GatewayFilterChain chain = ignored -> exchange.getResponse().setComplete();

        new RateLimitHeadersFilter().filter(exchange, chain).block();

        assertThat(exchange.getResponse().getHeaders().get("RateLimit-Limit")).containsExactly("0");
        assertThat(exchange.getResponse().getHeaders().get("RateLimit-Remaining")).containsExactly("0");
        assertThat(exchange.getResponse().getHeaders().get("RateLimit-Reset")).containsExactly("1");
        assertThat(exchange.getResponse().getHeaders().get("Retry-After")).containsExactly("1");
    }

    @Test
    void preservesLimiterHeadersAndCopiesLegacyNames() {
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/products").build());
        exchange.getResponse().setStatusCode(HttpStatus.OK);
        exchange.getResponse().getHeaders().put("X-RateLimit-Limit", List.of("10"));
        exchange.getResponse().getHeaders().put("X-RateLimit-Remaining", List.of("9"));
        exchange.getResponse().getHeaders().put("X-RateLimit-Reset", List.of("2"));
        new RateLimitHeadersFilter().filter(exchange, ignored -> exchange.getResponse().setComplete()).block();

        assertThat(exchange.getResponse().getHeaders().getFirst("RateLimit-Limit")).isEqualTo("10");
        assertThat(exchange.getResponse().getHeaders().getFirst("RateLimit-Remaining")).isEqualTo("9");
        assertThat(exchange.getResponse().getHeaders().getFirst("RateLimit-Reset")).isEqualTo("2");
    }
}
