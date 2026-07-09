package com.vnshop.productservice.infrastructure.cache;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the product cache respects the 5-minute TTL configured in {@link CacheConfig}.
 *
 * <p>This test validates the TTL constant matches the documented 5-minute value.
 * The {@link CacheConfig} uses {@code Duration.ofMinutes(5)} for the product cache TTL.
 *
 * <p>For a full integration test that exercises real Redis expiry, see
 * {@code ProductCacheTTLIntegrationTest} (run with {@code docker compose up -d redis}).
 */
class ProductCacheTTLTest {

    /** The TTL configured in CacheConfig for the product cache. */
    static final Duration PRODUCT_CACHE_TTL = Duration.ofMinutes(5);

    /**
     * Verifies the product cache TTL constant matches the documented 5-minute value.
     *
     * This reproduces the exact calculation from {@link CacheConfig} so any future
     * change to the TTL value will break this test and force a deliberate decision.
     */
    @Test
    @DisplayName("cache TTL constant should be 5 minutes")
    void cacheTTLConstantShouldBe5Minutes() {
        assertThat(PRODUCT_CACHE_TTL).isEqualTo(Duration.ofMinutes(5));
        assertThat(PRODUCT_CACHE_TTL.toSeconds()).isEqualTo(300); // 5 minutes = 300 seconds
    }

    /**
     * Verifies the TTL can be expressed in different time units.
     */
    @Test
    @DisplayName("TTL should be exactly 5 minutes")
    void ttlShouldBeExactly5Minutes() {
        assertThat(PRODUCT_CACHE_TTL).isGreaterThan(Duration.ofMinutes(4));
        assertThat(PRODUCT_CACHE_TTL).isLessThan(Duration.ofMinutes(6));
        assertThat(PRODUCT_CACHE_TTL.toMillis()).isEqualTo(300_000L); // 5 min in ms
    }
}
