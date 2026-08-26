package com.vnshop.productservice.infrastructure.cache;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;

import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheWriter;

class SingleFlightRedisCacheTest {
    @Test
    void concurrentColdMissesInvokeLoaderOnce() throws Exception {
        RedisCacheWriter writer = mock(RedisCacheWriter.class);
        when(writer.get(anyString(), any(), any(), any(), anyBoolean()))
                .thenAnswer(invocation -> invocation.getArgument(2, java.util.function.Supplier.class).get());
        SingleFlightRedisCache cache = new SingleFlightRedisCache(
                "single-flight", writer, RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(5)));
        CountDownLatch loaderStarted = new CountDownLatch(1);
        CountDownLatch releaseLoader = new CountDownLatch(1);
        AtomicInteger calls = new AtomicInteger();
        var pool = Executors.newFixedThreadPool(16);
        try {
            var futures = java.util.stream.IntStream.range(0, 16)
                    .mapToObj(index -> pool.submit(() -> cache.get("key", () -> {
                        calls.incrementAndGet();
                        loaderStarted.countDown();
                        assertThat(releaseLoader.await(1, TimeUnit.SECONDS)).isTrue();
                        return "value";
                    })))
                    .toList();
            assertThat(loaderStarted.await(1, TimeUnit.SECONDS)).isTrue();
            releaseLoader.countDown();
            assertThat(futures.stream().map(future -> get(future)).distinct())
                    .containsExactly("value");
            assertThat(calls).hasValue(1);
        } finally {
            releaseLoader.countDown();
            pool.shutdownNow();
        }
    }

    private static String get(java.util.concurrent.Future<String> future) {
        try {
            return future.get(2, TimeUnit.SECONDS);
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new AssertionError(failure);
        } catch (java.util.concurrent.ExecutionException | java.util.concurrent.TimeoutException failure) {
            throw new AssertionError(failure);
        }
    }
}
