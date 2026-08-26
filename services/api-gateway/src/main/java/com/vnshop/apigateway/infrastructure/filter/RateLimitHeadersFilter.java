package com.vnshop.apigateway.infrastructure.filter;

import org.jspecify.annotations.NonNull;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import java.util.UUID;

/** Emits the standard RateLimit response headers for gateway throttling. */
@Component
public class RateLimitHeadersFilter implements GlobalFilter, Ordered {

    private static final String LIMIT = "RateLimit-Limit";
    private static final String REMAINING = "RateLimit-Remaining";
    private static final String RESET = "RateLimit-Reset";

    @Override
    public @NonNull Mono<Void> filter(ServerWebExchange exchange, @NonNull GatewayFilterChain chain) {
        exchange.getResponse().beforeCommit(() -> {
            var headers = exchange.getResponse().getHeaders();
            copyIfPresent(headers, LIMIT, "X-RateLimit-Limit");
            copyIfPresent(headers, REMAINING, "X-RateLimit-Remaining");
            copyIfPresent(headers, RESET, "X-RateLimit-Reset");
            if (exchange.getResponse().getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
                headers.putIfAbsent(LIMIT, java.util.List.of("0"));
                headers.putIfAbsent(REMAINING, java.util.List.of("0"));
                headers.putIfAbsent(RESET, java.util.List.of("1"));
                if (headers.getFirst("Retry-After") == null) {
                    headers.set("Retry-After", "1");
                }
                String requestId = headers.getFirst("X-Request-ID");
                if (requestId == null || requestId.isBlank()) headers.set("X-Request-ID", UUID.randomUUID().toString());
            }
            return Mono.empty();
        });
        return chain.filter(exchange);
    }

    private static void copyIfPresent(
            org.springframework.http.HttpHeaders headers, String target, String source) {
        if (headers.getFirst(target) == null && headers.getFirst(source) != null) {
            headers.set(target, headers.getFirst(source));
        }
    }

    @Override
    public int getOrder() {
        return -100;
    }
}
