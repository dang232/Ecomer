package com.vnshop.productservice.infrastructure.cache;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Optional;

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

    @Test
    @DisplayName("cache TTL varies within ten percent of five minutes")
    void cacheTtlVariesWithinTenPercentOfFiveMinutes() {
        for (int sample = 0; sample < 200; sample++) {
            Duration ttl = CacheConfig.ttlFor("product-" + sample, "value");
            assertThat(ttl).isBetween(Duration.ofSeconds(270), Duration.ofSeconds(330));
        }
    }

    @Test
    @DisplayName("missing product TTL is bounded to thirty seconds")
    void missingProductTtlIsBoundedToThirtySeconds() {
        assertThat(CacheConfig.ttlFor("missing", Optional.empty())).isEqualTo(Duration.ofSeconds(30));
    }
}
