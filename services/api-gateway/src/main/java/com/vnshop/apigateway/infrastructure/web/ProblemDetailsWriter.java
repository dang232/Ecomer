package com.vnshop.apigateway.infrastructure.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

public final class ProblemDetailsWriter {
    private ProblemDetailsWriter() {}

    public static Mono<Void> write(ServerWebExchange exchange, ObjectMapper mapper, HttpStatus status,
                                   String code, String detail, boolean retryable) {
        String requestId = exchange.getRequest().getHeaders().getFirst("X-Request-ID");
        if (requestId == null || requestId.isBlank() || requestId.length() > 128) requestId = UUID.randomUUID().toString();
        exchange.getResponse().getHeaders().set("X-Request-ID", requestId);
        if (retryable) exchange.getResponse().getHeaders().set("Retry-After", "1");
        ErrorResponse body = ErrorResponse.of(code, detail, status.value(), List.of(), requestId);
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_PROBLEM_JSON);
        try {
            byte[] bytes = mapper.writeValueAsBytes(body);
            return response.writeWith(Mono.just(response.bufferFactory().wrap(bytes)));
        } catch (JsonProcessingException exception) {
            return response.setComplete();
        }
    }
}
