package com.vnshop.productservice.application.video;

import java.time.Duration;

/**
 * Redis-backed state for the video upload service: rate limits, concurrent
 * session counts, resumable upload offsets, idempotency-key dedup.
 *
 * <p>H5 fix: extracts the direct {@code StringRedisTemplate} dependency from
 * {@link VideoUploadService} so the service is testable without a real Redis
 * instance, and so the application layer does not depend on a Spring Data
 * infrastructure class.
 *
 * <p>All keys carry a TTL (2h for offset/total-size, 24h for idempotency, 1h
 * for concurrent session) so a Redis restart or eviction is self-healing.
 */
public interface VideoRedisPort {

    // Rate limit (POST creation)

    /** Returns the new counter value after incrementing the user's POST rate-limit key. */
    long incrementPostRateLimit(String uploaderId);

    /** Sets a 1s TTL on the rate-limit key. Called on first increment only. */
    void setPostRateLimitTtl(String uploaderId, Duration ttl);

    // Concurrent sessions

    /** Returns the current concurrent-session count for the user. */
    long getConcurrentSessions(String uploaderId);

    /** Atomically increments the concurrent-session counter. */
    long incrementConcurrentSessions(String uploaderId);

    /** Atomically decrements; deletes the key if it drops to 0 or below. */
    void decrementConcurrentSessions(String uploaderId);

    /** Sets the concurrent-session counter's TTL (1h safety net). */
    void setConcurrentSessionsTtl(String uploaderId, Duration ttl);

    // Offset / total size (resume support)

    void setOffset(java.util.UUID videoId, long offset, Duration ttl);
    long getOffset(java.util.UUID videoId);
    void deleteOffset(java.util.UUID videoId);

    void setTotalSize(java.util.UUID videoId, long totalSize, Duration ttl);
    long getTotalSize(java.util.UUID videoId);
    void deleteTotalSize(java.util.UUID videoId);

    // Idempotency

    /** Atomically reserves a scoped operation key until the creator completes or the TTL expires. */
    boolean claimIdempotencyKey(String idempotencyKey, String videoId, Duration ttl);

    /** Atomically publishes the completed result and removes the creator reservation. */
    boolean completeIdempotencyKey(String idempotencyKey, String videoId, Duration ttl);

    /** Releases a reservation only when it is still owned by the supplied video id. */
    void releaseIdempotencyReservation(String idempotencyKey, String videoId);

    /** Deletes the completed mapping associated with a cancelled video. */
    void releaseIdempotencyKeyForVideo(String videoId);

    String getIdempotencyKey(String idempotencyKey);
    boolean hasIdempotencyReservation(String idempotencyKey);
}
