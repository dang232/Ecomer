package com.vnshop.apigateway.infrastructure.config;

import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import reactor.core.publisher.Mono;

/** Keeps gateway buckets under the shared VNShop rate-limit namespace. */
public class NamespacedRedisRateLimiter extends RedisRateLimiter {
    private static final String ROUTE_NAMESPACE = "vnshop:ratelimit:v1:";

    public NamespacedRedisRateLimiter(int replenishRate, int burstCapacity, int requestedTokens) {
        super(replenishRate, burstCapacity, requestedTokens);
    }

    @Override
    public Mono<Response> isAllowed(String routeId, String id) {
        return super.isAllowed(ROUTE_NAMESPACE + routeId, id);
    }
}
