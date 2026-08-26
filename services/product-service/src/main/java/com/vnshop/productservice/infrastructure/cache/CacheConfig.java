package com.vnshop.productservice.infrastructure.cache;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.cache.RedisCacheWriter;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

/**
 * Wires Spring's @Cacheable backed by Redis. Cache "product" has a 5-min TTL —
 * short enough that admin/seller edits propagate quickly without explicit
 * eviction, long enough to absorb hot-product read traffic.
 *
 * <p>The {@link CacheErrorHandler} swallows Redis-down errors and lets the
 * underlying repository call run, so a Redis outage degrades to "every read
 * hits Postgres" instead of "every read 500s." This matches the platform's
 * fail-open policy used elsewhere (idempotency filter, gateway rate limit).
 *
 * <p>Activated only when {@code spring.cache.type=redis} (the default in prod).
 * Tests set {@code spring.cache.type=none} so no Redis is required.
 */
@Configuration
@ConditionalOnProperty(prefix = "spring.cache", name = "type", havingValue = "redis", matchIfMissing = true)
public class CacheConfig implements CachingConfigurer {

    static final String PRODUCT_CACHE = "product";
    static final Duration PRODUCT_CACHE_TTL = Duration.ofMinutes(5);
    static final Duration NEGATIVE_CACHE_TTL = Duration.ofSeconds(30);
    static final RedisCacheWriter.TtlFunction JITTERED_TTL = CacheConfig::ttlFor;

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration productConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(JITTERED_TTL)
                .disableCachingNullValues()
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(
                        new GenericJackson2JsonRedisSerializer()))
                .prefixCacheNameWith("vnshop:cache:v2::");
        return new RedisCacheManager(RedisCacheWriter.nonLockingRedisCacheWriter(connectionFactory),
                RedisCacheConfiguration.defaultCacheConfig(),
                java.util.Map.of(PRODUCT_CACHE, productConfig)) {
            @Override
            protected SingleFlightRedisCache createRedisCache(
                    String cacheName, RedisCacheConfiguration cacheConfiguration) {
                return new SingleFlightRedisCache(cacheName, getCacheWriter(), cacheConfiguration);
            }
        };
    }

    static Duration ttlFor(Object key, Object value) {
        if (value instanceof Optional<?> optional && optional.isEmpty()) {
            return NEGATIVE_CACHE_TTL;
        }
        long seconds = ThreadLocalRandom.current().nextLong(270, 331);
        return Duration.ofSeconds(Math.max(1, seconds));
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return new LoggingCacheErrorHandler();
    }

    private static final class LoggingCacheErrorHandler implements CacheErrorHandler {
        private static final Logger LOGGER = LoggerFactory.getLogger(LoggingCacheErrorHandler.class);

        @Override
        public void handleCacheGetError(RuntimeException ex, Cache cache, Object key) {
            LOGGER.warn("cache-get-failed cache={} key={}: {}", cache.getName(), key, ex.getMessage());
        }

        @Override
        public void handleCachePutError(RuntimeException ex, Cache cache, Object key, Object value) {
            LOGGER.warn("cache-put-failed cache={} key={}: {}", cache.getName(), key, ex.getMessage());
        }

        @Override
        public void handleCacheEvictError(RuntimeException ex, Cache cache, Object key) {
            LOGGER.warn("cache-evict-failed cache={} key={}: {}", cache.getName(), key, ex.getMessage());
        }

        @Override
        public void handleCacheClearError(RuntimeException ex, Cache cache) {
            LOGGER.warn("cache-clear-failed cache={}: {}", cache.getName(), ex.getMessage());
        }
    }
}
