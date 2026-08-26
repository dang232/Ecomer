package com.vnshop.apigateway.infrastructure.filter;

import java.net.URI;
import java.time.Instant;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public final class LegacyApiVersioningFilter implements GlobalFilter, Ordered {
    private static final String API_PREFIX = "/api/v1";
    private static final Duration DEFAULT_SUNSET_AFTER = Duration.ofDays(90);
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE");
    private static final Set<String> EXCLUDED_PREFIXES = Set.of(
            API_PREFIX, "/api/config", "/webhooks/", "/ws/", "/monitoring/", "/realms/", "/resources/",
            "/user-service/", "/order-service/", "/payment-service/", "/product-service/", "/notification-service/");
    private static final List<String> VERSIONED_PREFIXES = List.of(
            "/products/", "/videos/", "/categories/", "/search/", "/flash-sale/", "/questions/", "/reviews/",
            "/sellers/", "/users/", "/auth/", "/cart/", "/seller/orders/", "/checkout/", "/returns/", "/invoices/",
            "/orders/", "/payment/", "/shipping/", "/notifications/", "/messaging/", "/coupons/", "/seller-finance/",
            "/recommendations/", "/admin/");
    private static final DateTimeFormatter HTTP_DATE = DateTimeFormatter.RFC_1123_DATE_TIME
            .withZone(ZoneOffset.UTC);

    private final String successorBaseUrl;
    private final String sunset;

    public LegacyApiVersioningFilter(
            @Value("${vnshop.api.versioning.successor-base-url:http://localhost:8080}") String successorBaseUrl,
            @Value("${vnshop.api.versioning.sunset:}") String configuredSunset) {
        this.successorBaseUrl = successorBaseUrl.replaceAll("/$", "");
        Instant sunset = configuredSunset.isBlank()
                ? Instant.now().plus(DEFAULT_SUNSET_AFTER)
                : Instant.parse(configuredSunset);
        this.sunset = HTTP_DATE.format(sunset);
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, org.springframework.cloud.gateway.filter.GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().pathWithinApplication().value();
        if (!shouldRedirect(path)) {
            return chain.filter(exchange);
        }

        URI successor = URI.create(successorBaseUrl + API_PREFIX + path
                + (exchange.getRequest().getURI().getRawQuery() == null
                        ? ""
                        : "?" + exchange.getRequest().getURI().getRawQuery()));
        HttpHeaders headers = exchange.getResponse().getHeaders();
        headers.setLocation(successor);
        headers.set("Deprecation", "true");
        headers.set("Sunset", sunset);
        headers.set("Link", "<" + successor + ">; rel=\"successor-version\"");
        headers.setCacheControl("no-store");
        HttpStatus redirectStatus = SAFE_METHODS.contains(exchange.getRequest().getMethod().name())
                ? HttpStatus.PERMANENT_REDIRECT
                : HttpStatus.TEMPORARY_REDIRECT;
        exchange.getResponse().setStatusCode(redirectStatus);
        return exchange.getResponse().setComplete();
    }

    @Override
    public int getOrder() {
        return -200;
    }

    private static boolean shouldRedirect(String path) {
        if (EXCLUDED_PREFIXES.stream().anyMatch(prefix -> hasPathPrefix(path, prefix))) {
            return false;
        }
        return VERSIONED_PREFIXES.stream().anyMatch(prefix -> hasPathPrefix(path, prefix));
    }

    private static boolean hasPathPrefix(String path, String prefix) {
        String normalized = prefix.endsWith("/") ? prefix.substring(0, prefix.length() - 1) : prefix;
        return path.equals(normalized) || path.startsWith(normalized + "/");
    }
}
