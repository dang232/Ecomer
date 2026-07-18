package com.vnshop.apigateway.infrastructure.filter;

import org.jspecify.annotations.NonNull;
import org.springframework.core.annotation.Order;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.UUID;

@Component
@Order(-1)
public class CorrelationIdFilter implements WebFilter {

    public static final String CORRELATION_ID_HEADER = "X-Correlation-ID";

    @Override
    public @NonNull Mono<Void> filter(ServerWebExchange exchange, @NonNull WebFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String correlationId = request.getHeaders().getFirst(CORRELATION_ID_HEADER);
        String requestId = request.getHeaders().getFirst("X-Request-ID");

        String effectiveId = valid(correlationId)
                ? correlationId
                : valid(requestId) ? requestId : UUID.randomUUID().toString();

        ServerHttpRequest normalizedRequest = request.mutate()
                .header(CORRELATION_ID_HEADER, effectiveId)
                .header("X-Request-ID", effectiveId)
                .build();
        ServerWebExchange normalizedExchange = exchange.mutate().request(normalizedRequest).build();
        normalizedExchange.getAttributes().put(CORRELATION_ID_HEADER, effectiveId);
        normalizedExchange.getResponse().getHeaders().set(CORRELATION_ID_HEADER, effectiveId);
        normalizedExchange.getResponse().getHeaders().set("X-Request-ID", effectiveId);

        return chain.filter(normalizedExchange);
    }

    private static boolean valid(String value) {
        return value != null && value.length() <= 128 && value.matches("[A-Za-z0-9._:-]+");
    }
}
