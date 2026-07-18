package com.vnshop.apigateway.infrastructure.filter;

import org.jspecify.annotations.NonNull;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/** Adds a bounded retry hint to gateway-generated 429 responses. */
@Component
public class RateLimitHeadersFilter implements GlobalFilter, Ordered {

    @Override
    public @NonNull Mono<Void> filter(ServerWebExchange exchange, @NonNull GatewayFilterChain chain) {
        exchange.getResponse().beforeCommit(() -> {
            if (exchange.getResponse().getStatusCode() == HttpStatus.TOO_MANY_REQUESTS
                    && exchange.getResponse().getHeaders().getFirst("Retry-After") == null) {
                exchange.getResponse().getHeaders().set("Retry-After", "1");
            }
            return Mono.empty();
        });
        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return -100;
    }
}
