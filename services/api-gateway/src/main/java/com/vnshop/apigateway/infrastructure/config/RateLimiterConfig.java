package com.vnshop.apigateway.infrastructure.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Per-route rate limiter beans wired into Spring Cloud Gateway's
 * {@link org.springframework.cloud.gateway.filter.factory.RequestRateLimiterGatewayFilterFactory}.
 *
 * <p>Each route family gets a {@link TieredRateLimiter} that dispatches to
 * either an anonymous-tier or an authenticated-tier {@link RedisRateLimiter}
 * depending on the key prefix produced by {@link TieredKeyResolver}:
 *
 * <pre>
 * Route family  | Anon replenish/burst | Auth replenish/burst
 * --------------|----------------------|---------------------
 * payment       |   1 / 2              |   5 / 10
 * auth          |   3 / 5              |  10 / 20
 * search        |   5 / 10             |  20 / 40
 * general       |  10 / 20             |  30 / 60
 * </pre>
 *
 * <p>The {@link #tieredKeyResolver()} bean is marked {@link Primary} so it
 * satisfies the single {@link KeyResolver} injection point expected by any
 * remaining {@code RequestRateLimiter} filter that does not specify an
 * explicit qualifier.
 */
@Configuration
public class RateLimiterConfig {

    // -----------------------------------------------------------------------
    // Key resolver
    // -----------------------------------------------------------------------

    @Bean
    @Primary
    KeyResolver tieredKeyResolver() {
        return new TieredKeyResolver();
    }

    // -----------------------------------------------------------------------
    // Payment route: 1 req/s burst 2 (anon) | 5 req/s burst 10 (auth)
    // -----------------------------------------------------------------------

    @Bean
    RedisRateLimiter paymentAnonRateLimiter() {
        return new RedisRateLimiter(1, 2, 1);
    }

    @Bean
    RedisRateLimiter paymentAuthRateLimiter() {
        return new RedisRateLimiter(5, 10, 1);
    }

    @Bean
    TieredRateLimiter paymentRateLimiter(
            RedisRateLimiter paymentAnonRateLimiter,
            RedisRateLimiter paymentAuthRateLimiter) {
        return new TieredRateLimiter(paymentAnonRateLimiter, paymentAuthRateLimiter);
    }

    // -----------------------------------------------------------------------
    // Auth route: 3 req/s burst 5 — flat for BOTH anon and auth since
    // auth endpoints are login/register, not post-auth operations.
    // -----------------------------------------------------------------------

    @Bean
    RedisRateLimiter authAnonRateLimiter() {
        return new RedisRateLimiter(3, 5, 1);
    }

    @Bean
    RedisRateLimiter authAuthRateLimiter() {
        return new RedisRateLimiter(3, 5, 1);
    }

    @Bean
    TieredRateLimiter authRateLimiter(
            RedisRateLimiter authAnonRateLimiter,
            RedisRateLimiter authAuthRateLimiter) {
        return new TieredRateLimiter(authAnonRateLimiter, authAuthRateLimiter);
    }

    // -----------------------------------------------------------------------
    // Search route: 5 req/s burst 10 (anon) | 20 req/s burst 40 (auth)
    // -----------------------------------------------------------------------

    @Bean
    RedisRateLimiter searchAnonRateLimiter() {
        return new RedisRateLimiter(5, 10, 1);
    }

    @Bean
    RedisRateLimiter searchAuthRateLimiter() {
        return new RedisRateLimiter(20, 40, 1);
    }

    @Bean
    TieredRateLimiter searchRateLimiter(
            RedisRateLimiter searchAnonRateLimiter,
            RedisRateLimiter searchAuthRateLimiter) {
        return new TieredRateLimiter(searchAnonRateLimiter, searchAuthRateLimiter);
    }

    // -----------------------------------------------------------------------
    // General routes: 5 req/s burst 10 (anon) | 30 req/s burst 60 (auth)
    // NOTE: @Primary means SCG uses this for ALL rate-limited routes
    // regardless of per-route setRateLimiter(). Anon tier must be strict
    // enough to prevent brute-force on /auth/** as well.
    // -----------------------------------------------------------------------

    @Bean
    RedisRateLimiter generalAnonRateLimiter() {
        return new RedisRateLimiter(5, 10, 1);
    }

    @Bean
    RedisRateLimiter generalAuthRateLimiter() {
        return new RedisRateLimiter(30, 60, 1);
    }

    @Bean
    @Primary
    TieredRateLimiter generalRateLimiter(
            RedisRateLimiter generalAnonRateLimiter,
            RedisRateLimiter generalAuthRateLimiter) {
        return new TieredRateLimiter(generalAnonRateLimiter, generalAuthRateLimiter);
    }
}
