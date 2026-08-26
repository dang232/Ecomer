package com.vnshop.apigateway.infrastructure.route;

import com.vnshop.apigateway.infrastructure.config.PublicBucketProperties;
import com.vnshop.apigateway.infrastructure.config.TieredRateLimiter;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.route.builder.GatewayFilterSpec;

record RouteDependencies(
        String product, String user, String search, String inventory, String cart, String order, String payment,
        String shipping, String notification, String sellerFinance, String recommendations, String messaging,
        String monitoring, String configuration, String coupon, String keycloak, String minio, String configToken,
        PublicBucketProperties publicBuckets, TieredRateLimiter paymentLimiter, TieredRateLimiter authLimiter,
        TieredRateLimiter searchLimiter, TieredRateLimiter flashReserveLimiter, TieredRateLimiter flashStockLimiter,
        TieredRateLimiter flashActiveLimiter, TieredRateLimiter recommendationsLimiter, TieredRateLimiter generalLimiter,
        KeyResolver keyResolver) {

    RouteDependencies(String product, String user, String search, String inventory, String cart, String order,
            String payment, String shipping, String notification, String sellerFinance, String recommendations,
            String messaging, String monitoring, String configuration, String coupon, String keycloak, String minio,
            String configToken, PublicBucketProperties publicBuckets) {
        this(product, user, search, inventory, cart, order, payment, shipping, notification, sellerFinance,
                recommendations, messaging, monitoring, configuration, coupon, keycloak, minio, configToken,
                publicBuckets, null, null, null, null, null, null, null, null, null);
    }

    RouteDependencies withLimiters(TieredRateLimiter payment, TieredRateLimiter auth, TieredRateLimiter search,
            TieredRateLimiter flashReserve, TieredRateLimiter flashStock, TieredRateLimiter flashActive,
            TieredRateLimiter recommendations, TieredRateLimiter general, KeyResolver keyResolver) {
        return new RouteDependencies(product, user, searchService(), inventory, cart, order, this.payment, shipping,
                notification, sellerFinance, this.recommendations, messaging, monitoring, configuration, coupon,
                keycloak, minio, configToken, publicBuckets, payment, auth, search, flashReserve, flashStock,
                flashActive, recommendations, general, keyResolver);
    }

    private String searchService() { return search; }

    GatewayFilterSpec resilient(GatewayFilterSpec filters, String service) {
        return filters.filter(versionedPathRewrite())
                .circuitBreaker(config -> config.setName(service)
                .setFallbackUri("forward:/fallback/" + service));
    }

    GatewayFilterSpec rateLimited(GatewayFilterSpec filters, String service, TieredRateLimiter limiter) {
        return filters.filter(versionedPathRewrite())
                .requestRateLimiter(config -> config.setRateLimiter(limiter).setKeyResolver(keyResolver))
                .circuitBreaker(config -> config.setName(service)
                        .setFallbackUri("forward:/fallback/" + service));
    }

    private GatewayFilter versionedPathRewrite() {
        return (exchange, chain) -> {
            String path = exchange.getRequest().getPath().pathWithinApplication().value();
            if (!path.startsWith("/api/v1/")) {
                return chain.filter(exchange);
            }
            String downstreamPath = path.substring("/api/v1".length());
            var request = exchange.getRequest().mutate().path(downstreamPath).build();
            return chain.filter(exchange.mutate().request(request).build());
        };
    }
}
