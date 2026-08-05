package com.vnshop.productservice.infrastructure.storage;

import com.vnshop.productservice.application.video.VideoRedisPort;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * Default {@link VideoRedisPort} implementation backed by Spring Data Redis.
 * Centralises all key prefixes so callers don't reach into
 * {@code StringRedisTemplate} directly.
 */
@Component
@RequiredArgsConstructor
public class VideoRedisPortImpl implements VideoRedisPort {

    private static final String RATE_LIMIT_KEY_PREFIX = "video:ratelimit:post:";
    private static final String CONCURRENT_KEY_PREFIX  = "video:concurrent:";
    private static final String OFFSET_KEY_PREFIX       = "video:offset:";
    private static final String TOTAL_SIZE_KEY_PREFIX   = "video:total-size:";
    private static final String IDEMPOTENCY_KEY_PREFIX  = "video:idempotency:";
    private static final String IDEMPOTENCY_RESERVATION_KEY_PREFIX = "video:idempotency:reservation:";
    private static final String IDEMPOTENCY_VIDEO_KEY_PREFIX = "video:idempotency:video:";

    private static final DefaultRedisScript<Long> COMPLETE_IDEMPOTENCY_SCRIPT = new DefaultRedisScript<>("""
            if redis.call('get', KEYS[1]) == ARGV[1] then
                redis.call('set', KEYS[2], ARGV[1], 'EX', ARGV[2])
                redis.call('set', KEYS[3], ARGV[4], 'EX', ARGV[2])
                redis.call('del', KEYS[1])
                return 1
            end
            return 0
            """, Long.class);

    private static final DefaultRedisScript<Long> RELEASE_RESERVATION_SCRIPT = new DefaultRedisScript<>("""
            if redis.call('get', KEYS[1]) == ARGV[1] then
                redis.call('del', KEYS[1])
                return 1
            end
            return 0
            """, Long.class);

    private static final DefaultRedisScript<Long> RELEASE_VIDEO_MAPPING_SCRIPT = new DefaultRedisScript<>("""
            local operationKey = redis.call('get', KEYS[1])
            if operationKey and redis.call('get', ARGV[2] .. operationKey) == ARGV[1] then
                redis.call('del', ARGV[2] .. operationKey)
                redis.call('del', KEYS[1])
                return 1
            end
            return 0
            """, Long.class);

    private final StringRedisTemplate redis;

    @Override
    public long incrementPostRateLimit(String uploaderId) {
        Long v = redis.opsForValue().increment(RATE_LIMIT_KEY_PREFIX + uploaderId);
        return v == null ? 0L : v;
    }

    @Override
    public void setPostRateLimitTtl(String uploaderId, Duration ttl) {
        redis.expire(RATE_LIMIT_KEY_PREFIX + uploaderId, ttl);
    }

    @Override
    public long getConcurrentSessions(String uploaderId) {
        String raw = redis.opsForValue().get(CONCURRENT_KEY_PREFIX + uploaderId);
        return raw == null ? 0L : Long.parseLong(raw);
    }

    @Override
    public long incrementConcurrentSessions(String uploaderId) {
        Long v = redis.opsForValue().increment(CONCURRENT_KEY_PREFIX + uploaderId);
        return v == null ? 0L : v;
    }

    @Override
    public void decrementConcurrentSessions(String uploaderId) {
        Long remaining = redis.opsForValue().decrement(CONCURRENT_KEY_PREFIX + uploaderId);
        if (remaining != null && remaining <= 0) {
            redis.delete(CONCURRENT_KEY_PREFIX + uploaderId);
        }
    }

    @Override
    public void setConcurrentSessionsTtl(String uploaderId, Duration ttl) {
        redis.expire(CONCURRENT_KEY_PREFIX + uploaderId, ttl);
    }

    @Override
    public void setOffset(UUID videoId, long offset, Duration ttl) {
        redis.opsForValue().set(OFFSET_KEY_PREFIX + videoId, String.valueOf(offset), ttl);
    }

    @Override
    public long getOffset(UUID videoId) {
        String raw = redis.opsForValue().get(OFFSET_KEY_PREFIX + videoId);
        return raw == null ? 0L : Long.parseLong(raw);
    }

    @Override
    public void deleteOffset(UUID videoId) {
        redis.delete(OFFSET_KEY_PREFIX + videoId);
    }

    @Override
    public void setTotalSize(UUID videoId, long totalSize, Duration ttl) {
        redis.opsForValue().set(TOTAL_SIZE_KEY_PREFIX + videoId, String.valueOf(totalSize), ttl);
    }

    @Override
    public long getTotalSize(UUID videoId) {
        String raw = redis.opsForValue().get(TOTAL_SIZE_KEY_PREFIX + videoId);
        return raw == null ? 0L : Long.parseLong(raw);
    }

    @Override
    public void deleteTotalSize(UUID videoId) {
        redis.delete(TOTAL_SIZE_KEY_PREFIX + videoId);
    }

    @Override
    public boolean claimIdempotencyKey(String idempotencyKey, String videoId, Duration ttl) {
        Boolean claimed = redis.opsForValue().setIfAbsent(
                reservationKey(idempotencyKey), videoId, ttl);
        return Boolean.TRUE.equals(claimed);
    }

    @Override
    public boolean completeIdempotencyKey(String idempotencyKey, String videoId, Duration ttl) {
        Long completed = redis.execute(
                COMPLETE_IDEMPOTENCY_SCRIPT,
                List.of(reservationKey(idempotencyKey), resultKey(idempotencyKey), videoKey(videoId)),
                videoId,
                String.valueOf(ttl.toSeconds()),
                idempotencyKey,
                videoId);
        return Long.valueOf(1L).equals(completed);
    }

    @Override
    public void releaseIdempotencyReservation(String idempotencyKey, String videoId) {
        redis.execute(
                RELEASE_RESERVATION_SCRIPT,
                List.of(reservationKey(idempotencyKey)),
                videoId);
    }

    @Override
    public void releaseIdempotencyKeyForVideo(String videoId) {
        redis.execute(
                RELEASE_VIDEO_MAPPING_SCRIPT,
                List.of(videoKey(videoId)),
                videoId,
                IDEMPOTENCY_KEY_PREFIX);
    }

    @Override
    public String getIdempotencyKey(String idempotencyKey) {
        return redis.opsForValue().get(resultKey(idempotencyKey));
    }

    @Override
    public boolean hasIdempotencyReservation(String idempotencyKey) {
        return Boolean.TRUE.equals(redis.hasKey(reservationKey(idempotencyKey)));
    }

    private static String resultKey(String idempotencyKey) {
        return IDEMPOTENCY_KEY_PREFIX + idempotencyKey;
    }

    private static String reservationKey(String idempotencyKey) {
        return IDEMPOTENCY_RESERVATION_KEY_PREFIX + idempotencyKey;
    }

    private static String videoKey(String videoId) {
        return IDEMPOTENCY_VIDEO_KEY_PREFIX + videoId;
    }
}
