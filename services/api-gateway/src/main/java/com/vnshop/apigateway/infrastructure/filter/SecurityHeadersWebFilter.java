package com.vnshop.apigateway.infrastructure.filter;

import org.jspecify.annotations.NonNull;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

/**
 * Adds standard security headers to every gateway response.
 *
 * <p>Order is high so the headers survive downstream filter mutations.
 * X-Frame-Options mitigates clickjacking. X-Content-Type-Options stops MIME
 * sniffing. X-XSS-Protection (deprecated but still valuable for older browsers)
 * enables the browser's reflected-XSS filter. Referrer-Policy limits referrer
 * leakage on cross-origin navigation.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class SecurityHeadersWebFilter implements WebFilter {

    @Override
    public @NonNull Mono<Void> filter(
            @NonNull ServerWebExchange exchange,
            @NonNull WebFilterChain chain) {
        HttpHeaders resp = exchange.getResponse().getHeaders();
        resp.set("X-Frame-Options", "DENY");
        resp.set("X-Content-Type-Options", "nosniff");
        resp.set("X-XSS-Protection", "1; mode=block");
        resp.set("Referrer-Policy", "strict-origin-when-cross-origin");
        // CSP: gateway proxies API responses, not HTML — report-only header is
        // sufficient; the SPA sets its own Content-Security-Policy header.
        resp.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
        return chain.filter(exchange);
    }
}
