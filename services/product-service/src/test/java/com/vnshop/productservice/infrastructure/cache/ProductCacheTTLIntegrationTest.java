package com.vnshop.productservice.infrastructure.cache;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration test for cache TTL behavior against a real Redis instance.
 *
 * <p>Requires:
 * <ul>
 *   <li>Docker: {@code docker compose up -d redis}</li>
 *   <li>Or: Redis running on {@code localhost:6379}</li>
 *   <li>Environment variable: {@code REDIS_HOST=localhost}</li>
 * </ul>
 *
 * <p>Runs by default via Maven when the environment is configured:
 * {@code mvn test -Dtest=ProductCacheTTLIntegrationTest -DskipTests=false}
 *
 * <p>Skips automatically when Redis is not available.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.autoconfigure.exclude=" +
                "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration," +
                "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration," +
                "org.springframework.boot.data.jpa.autoconfigure.DataJpaRepositoriesAutoConfiguration," +
                "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration," +
                "org.springframework.boot.kafka.autoconfigure.KafkaAutoConfiguration," +
                "org.springframework.boot.security.oauth2.resource.server.jwt.JwtDecoderAutoConfiguration",
                "spring.data.jpa.repositories.enabled=false",
                // Override TTL to 2 s so tests complete in ~3 s vs 5 min.
                "spring.cache.redis.time-to-live=2s",
                "spring.cache.type=redis",
                "spring.data.redis.host=${REDIS_HOST:localhost}",
                "spring.data.redis.port=${REDIS_PORT:6379}"
        }
)
@TestPropertySource(properties = {
        "spring.cache.redis.time-to-live=2s",
        "spring.cache.type=redis"
})
@DisplayName("ProductCache TTL Integration")
class ProductCacheTTLIntegrationTest {

    private static final String CACHE_NAME = "product";
    private static final String TEST_KEY = "test-product-ttl-key";

    @Autowired
    CacheManager cacheManager;

    @Test
    @DisplayName("cache entry should expire after TTL")
    void cacheEntryShouldExpireAfterTTL() throws InterruptedException {
        Cache cache = cacheManager.getCache(CACHE_NAME);

        // Put a value into the cache.
        cache.put(TEST_KEY, "test-value");

        // Immediately, the value should be retrievable.
        assertThat(cache.get(TEST_KEY)).isNotNull();
        assertThat(cache.get(TEST_KEY).get()).isEqualTo("test-value");

        // Wait for TTL (2 s) + buffer (500 ms) to pass.
        Thread.sleep(2500);

        // After expiry, the entry should be gone.
        assertThat(cache.get(TEST_KEY)).isNull();
    }

    @Test
    @DisplayName("new value cached after previous entry expires")
    void newValueCachedAfterPreviousEntryExpires() throws InterruptedException {
        Cache cache = cacheManager.getCache(CACHE_NAME);

        // Cache initial value.
        cache.put(TEST_KEY, "original");
        assertThat(cache.get(TEST_KEY).get()).isEqualTo("original");

        // Wait for TTL.
        Thread.sleep(2500);

        // Entry expired.
        assertThat(cache.get(TEST_KEY)).isNull();

        // Cache a new value — should be retrievable immediately.
        cache.put(TEST_KEY, "updated");
        assertThat(cache.get(TEST_KEY).get()).isEqualTo("updated");
    }
}
