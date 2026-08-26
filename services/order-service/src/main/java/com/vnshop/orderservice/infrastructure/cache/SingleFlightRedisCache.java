package com.vnshop.orderservice.infrastructure.cache;

import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.data.redis.cache.RedisCache;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheWriter;

final class SingleFlightRedisCache extends RedisCache {
    private final ConcurrentMap<Object, CompletableFuture<Object>> loads = new ConcurrentHashMap<>();

    SingleFlightRedisCache(String name, RedisCacheWriter cacheWriter, RedisCacheConfiguration cacheConfiguration) {
        super(name, cacheWriter, cacheConfiguration);
    }

    @Override
    protected <T> T loadCacheValue(Object key, Callable<T> valueLoader) {
        CompletableFuture<Object> created = new CompletableFuture<>();
        CompletableFuture<Object> existing = loads.putIfAbsent(key, created);
        if (existing != null) {
            return join(existing);
        }
        try {
            T value = super.loadCacheValue(key, valueLoader);
            created.complete(value);
            return value;
        } catch (Throwable failure) {
            created.completeExceptionally(failure);
            throw failure;
        } finally {
            loads.remove(key, created);
        }
    }

    private static <T> T join(CompletableFuture<Object> future) {
        try {
            @SuppressWarnings("unchecked")
            T value = (T) future.join();
            return value;
        } catch (CompletionException failure) {
            Throwable cause = failure.getCause();
            if (cause instanceof RuntimeException runtimeFailure) {
                throw runtimeFailure;
            }
            if (cause instanceof Error error) {
                throw error;
            }
            throw failure;
        }
    }
}
