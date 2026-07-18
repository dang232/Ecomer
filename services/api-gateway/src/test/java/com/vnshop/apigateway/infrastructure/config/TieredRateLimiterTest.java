package com.vnshop.apigateway.infrastructure.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.cloud.gateway.filter.ratelimit.RateLimiter;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.HashMap;
import java.util.Map;

import static org.mockito.Mockito.*;

class TieredRateLimiterTest {

    private RedisRateLimiter anonLimiter;
    private RedisRateLimiter authLimiter;
    private TieredRateLimiter tieredRateLimiter;

    @BeforeEach
    void setUp() {
        anonLimiter = Mockito.mock(RedisRateLimiter.class);
        authLimiter = Mockito.mock(RedisRateLimiter.class);
        tieredRateLimiter = new TieredRateLimiter(anonLimiter, authLimiter);
    }

    @Test
    void anon_prefixed_key_delegates_to_anon_limiter() {
        RateLimiter.Response allowed = new RateLimiter.Response(true, headers("X-RateLimit-Remaining", "9"));
        when(anonLimiter.isAllowed("payment", "anon:203.0.113.5")).thenReturn(Mono.just(allowed));

        StepVerifier.create(tieredRateLimiter.isAllowed("payment", "anon:203.0.113.5"))
            .expectNext(allowed)
            .verifyComplete();

        verify(anonLimiter).isAllowed("payment", "anon:203.0.113.5");
        verifyNoInteractions(authLimiter);
    }

    @Test
    void user_prefixed_key_delegates_to_auth_limiter() {
        RateLimiter.Response allowed = new RateLimiter.Response(true, headers("X-RateLimit-Remaining", "29"));
        when(authLimiter.isAllowed("payment", "user:alice-uuid")).thenReturn(Mono.just(allowed));

        StepVerifier.create(tieredRateLimiter.isAllowed("payment", "user:alice-uuid"))
            .expectNext(allowed)
            .verifyComplete();

        verify(authLimiter).isAllowed("payment", "user:alice-uuid");
        verifyNoInteractions(anonLimiter);
    }

    @Test
    void anon_request_is_denied_when_bucket_exhausted() {
        RateLimiter.Response denied = new RateLimiter.Response(false, headers("X-RateLimit-Remaining", "0"));
        when(anonLimiter.isAllowed("auth", "anon:198.51.100.1")).thenReturn(Mono.just(denied));

        StepVerifier.create(tieredRateLimiter.isAllowed("auth", "anon:198.51.100.1"))
            .expectNextMatches(response -> !response.isAllowed())
            .verifyComplete();
    }

    @Test
    void reservation_rate_limit_failure_fails_closed() {
        when(anonLimiter.isAllowed("flash-sale-reserve", "anon:198.51.100.1"))
                .thenReturn(Mono.error(new IllegalStateException("redis unavailable")));

        StepVerifier.create(tieredRateLimiter.isAllowed("flash-sale-reserve", "anon:198.51.100.1"))
                .expectNextMatches(response -> !response.isAllowed()
                        && "1".equals(response.getHeaders().get("Retry-After")))
                .verifyComplete();
    }

    @Test
    void public_read_rate_limit_failure_fails_open() {
        when(anonLimiter.isAllowed("recommendations", "anon:198.51.100.1"))
                .thenReturn(Mono.error(new IllegalStateException("redis unavailable")));

        StepVerifier.create(tieredRateLimiter.isAllowed("recommendations", "anon:198.51.100.1"))
                .expectNextMatches(response -> response.isAllowed()
                        && "true".equals(response.getHeaders().get("X-RateLimit-Degraded")))
                .verifyComplete();
    }

    private Map<String, String> headers(String... keyValues) {
        Map<String, String> map = new HashMap<>();
        for (int i = 0; i < keyValues.length - 1; i += 2) {
            map.put(keyValues[i], keyValues[i + 1]);
        }
        return map;
    }
}
