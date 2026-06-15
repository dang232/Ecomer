package com.vnshop.productservice.application.video;

import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoEvent;
import com.vnshop.productservice.domain.video.VideoOwnerType;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.VideoStatusHistory;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;

/**
 * Application service for tus-based video uploads.
 *
 * <p>Handles the full tus lifecycle:
 * <ul>
 *   <li>POST (Creation) — validate idempotency key, check quotas, rate limit, create UPLOADING video</li>
 *   <li>PATCH (Upload) — receive chunk, validate magic bytes on first chunk, update streaming SHA-256</li>
 *   <li>HEAD (Offset query) — return current upload offset</li>
 *   <li>DELETE (Cancel) — delete staging object and mark video DELETED</li>
 *   <li>User DELETE — owner soft-delete of PUBLISHED video</li>
 *   <li>Appeal — owner submits appeal for REJECTED video</li>
 * </ul>
 */
@RequiredArgsConstructor
public class VideoUploadService {

    private static final Logger LOGGER = LoggerFactory.getLogger(VideoUploadService.class);

    // Magic byte signatures for allowed video formats
    private static final byte[] MAGIC_MP4_MOV = new byte[]{0x66, 0x74, 0x79, 0x70}; // "ftyp" at offset 4
    private static final byte[] MAGIC_MKV     = new byte[]{0x1A, 0x45, (byte) 0xDF, (byte) 0xA3};
    private static final byte[] MAGIC_WEBM    = new byte[]{0x1A, 0x45, (byte) 0xDF, (byte) 0xA3};
    private static final byte[] MAGIC_RIFF    = new byte[]{0x52, 0x49, 0x46, 0x46}; // "RIFF" for WebM/AVI

    static final long MAX_PRODUCT_VIDEO_BYTES = 500L * 1024 * 1024; // 500 MB
    static final long MAX_REVIEW_VIDEO_BYTES  = 200L * 1024 * 1024; // 200 MB
    static final int  MAX_VIDEOS_PER_DAY = 10;
    static final int  MAX_VIDEOS_PER_PRODUCT = 3;
    static final int  MAX_VIDEOS_PER_REVIEW = 1;
    static final int  MAX_CONCURRENT_SESSIONS = 2;
    static final Duration STUCK_VIDEO_THRESHOLD = Duration.ofMinutes(10);

    // Redis key patterns
    private static final String RATE_LIMIT_KEY_PREFIX = "video:ratelimit:post:";
    private static final String CONCURRENT_KEY_PREFIX  = "video:concurrent:";
    private static final String SHA256_STATE_KEY_PREFIX = "video:sha256:";
    private static final String OFFSET_KEY_PREFIX       = "video:offset:";
    private static final String TOTAL_SIZE_KEY_PREFIX   = "video:total-size:";
    private static final String IDEMPOTENCY_KEY_PREFIX  = "video:idempotency:";
    private static final Duration IDEMPOTENCY_TTL       = Duration.ofHours(24);

    private final VideoJpaRepository videoJpaRepository;
    private final LocalStagingStore localStagingStore;
    private final VideoEventPublisherPort videoEventPublisherPort;
    private final StringRedisTemplate redisTemplate;

    // -------------------------------------------------------------------------
    // POST — tus Creation
    // -------------------------------------------------------------------------

    /**
     * Creates a new upload session.
     *
     * @param uploaderId     JWT subject of the requesting user
     * @param ownerType      {@link VideoOwnerType#PRODUCT} or {@link VideoOwnerType#REVIEW}
     * @param ownerId        UUID of the product or review
     * @param idempotencyKey client-supplied idempotency key (from Upload-Metadata)
     * @param contentLength  declared total file size
     * @return the created Video in UPLOADING status
     */
    public Video createUploadSession(String uploaderId, VideoOwnerType ownerType, UUID ownerId,
            String idempotencyKey, long contentLength) {
        // Spec MED-5: idempotency-key dedup — duplicate POSTs within 24h return existing upload URL.
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            String existingVideoId = redisTemplate.opsForValue()
                    .get(IDEMPOTENCY_KEY_PREFIX + idempotencyKey);
            if (existingVideoId != null) {
                Video existing = videoJpaRepository.findById(UUID.fromString(existingVideoId))
                        .orElseThrow(() -> new IllegalStateException(
                                "Idempotency record points to missing video " + existingVideoId));
                LOGGER.info("Idempotency hit: returning existing video {} for key={}", existingVideoId, idempotencyKey);
                return existing;
            }
        }

        enforceRateLimit(uploaderId);
        enforceConcurrentSessionLimit(uploaderId);
        enforceFileSizeLimit(contentLength, ownerType);
        enforceQuotas(uploaderId, ownerType, ownerId);

        UUID videoId = UUID.randomUUID();
        String stagingKey = "videos/staging/" + videoId;

        Video video = new Video(
                videoId,
                uploaderId,
                ownerType == VideoOwnerType.PRODUCT ? ownerId.toString() : null,
                ownerType == VideoOwnerType.REVIEW ? ownerId.toString() : null,
                stagingKey,
                null,
                VideoStatus.UPLOADING,
                null, null, null, null,
                Instant.now());

        Video saved = videoJpaRepository.save(video);
        videoJpaRepository.saveHistory(
                VideoStatusHistory.record(videoId, null, VideoStatus.UPLOADING, uploaderId, "upload created"));

        // Record idempotency key (24h TTL) so duplicate POSTs return the same upload.
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            redisTemplate.opsForValue().set(
                    IDEMPOTENCY_KEY_PREFIX + idempotencyKey, videoId.toString(), IDEMPOTENCY_TTL);
        }

        // Track concurrent session in Redis (TTL = 1 hour)
        String concurrentKey = CONCURRENT_KEY_PREFIX + uploaderId;
        redisTemplate.opsForValue().increment(concurrentKey);
        redisTemplate.expire(concurrentKey, Duration.ofHours(1));

        // Initialise upload offset in Redis; SHA-256 is now computed on finalise from the local staging file.
        redisTemplate.opsForValue().set(OFFSET_KEY_PREFIX + videoId, "0", Duration.ofHours(2));
        // Store declared total size so appendChunk can detect the final chunk on its own (H4 fix).
        redisTemplate.opsForValue().set(TOTAL_SIZE_KEY_PREFIX + videoId, String.valueOf(contentLength), Duration.ofHours(2));

        LOGGER.info("Created upload session videoId={} uploader={} stagingKey={}", videoId, uploaderId, stagingKey);
        return saved;
    }

    // -------------------------------------------------------------------------
    // PATCH — chunk upload
    // -------------------------------------------------------------------------

    /**
     * Receives a chunk and appends it to the staging object.
     * On the first chunk, validates magic bytes.
     * On the final chunk, emits video.upload.completed.
     *
     * @param videoId      upload session ID
     * @param uploaderId   must match the session owner
     * @param chunkOffset  tus Upload-Offset header value
     * @param chunkLength  Content-Length of this chunk
     * @param chunkData    raw chunk bytes
     * @return updated Video
     */
    public Video appendChunk(UUID videoId, String uploaderId, long chunkOffset,
            long chunkLength, byte[] chunkData) {
        Video video = findAndAuthorise(videoId, uploaderId);
        requireStatus(video, VideoStatus.UPLOADING);

        if (isFirstChunk(chunkOffset)) {
            validateMagicBytes(chunkData);
        }

        // CRITICAL-1 fix: write chunks to local staging file (RandomAccessFile supports resume
        // from a non-zero offset). On finaliseUpload, the assembled file is PUT to S3 as a
        // single object — the transcoder can then download it from the staging bucket.
        long newOffset;
        try {
            newOffset = localStagingStore.writeChunk(videoId, chunkOffset, chunkData, (int) chunkLength);
        } catch (IOException ex) {
            throw new VideoValidationException("staging_write_failed",
                    "Could not write chunk to local staging: " + ex.getMessage());
        }

        // Persist current offset in Redis so HEAD requests can return it for resume.
        redisTemplate.opsForValue().set(OFFSET_KEY_PREFIX + videoId, String.valueOf(newOffset), Duration.ofHours(2));

        // H4 fix: detect final chunk inside the service using the declared total size
        // (set on session creation). This eliminates the controller's responsibility
        // for knowing completion semantics, and means a client crash between PATCH
        // and the next PATCH is fine — the reaper catches truly stuck sessions.
        String totalSizeRaw = redisTemplate.opsForValue().get(TOTAL_SIZE_KEY_PREFIX + videoId);
        if (totalSizeRaw != null) {
            long totalSize = Long.parseLong(totalSizeRaw);
            if (newOffset >= totalSize) {
                finaliseUpload(videoId, uploaderId);
            }
        }

        return video;
    }

    private static final long FIRST_CHUNK_OFFSET = 0L;

    private static boolean isFirstChunk(long chunkOffset) {
        return chunkOffset == FIRST_CHUNK_OFFSET;
    }

    /**
     * Called by the controller when the final chunk has been fully received.
     * Finalises the incremental SHA-256 accumulated across all chunks,
     * transitions to UPLOADED, emits event, and decrements concurrency.
     */
    public Video finaliseUpload(UUID videoId, String uploaderId) {
        Video video = findAndAuthorise(videoId, uploaderId);
        requireStatus(video, VideoStatus.UPLOADING);

        // CRITICAL-1 fix: PUT the locally-staged assembled file to S3 in a single object.
        // SHA-256 is computed in a single pass during the PUT (DigestComputingInputStream).
        String computedSha256Hex;
        try {
            computedSha256Hex = localStagingStore.putObject(videoId, video.stagingKey());
        } catch (IOException ex) {
            throw new VideoValidationException("staging_finalise_failed",
                    "Could not upload assembled staging file: " + ex.getMessage());
        }

        Video uploaded = video.withStatus(VideoStatus.UPLOADED);
        Video saved = videoJpaRepository.save(uploaded);
        videoJpaRepository.saveHistory(
                VideoStatusHistory.record(videoId, VideoStatus.UPLOADING, VideoStatus.UPLOADED, uploaderId, null));

        // Decrement concurrent session counter
        decrementConcurrentSessions(uploaderId);
        redisTemplate.delete(OFFSET_KEY_PREFIX + videoId);
        redisTemplate.delete(TOTAL_SIZE_KEY_PREFIX + videoId);

        videoEventPublisherPort.publish(new VideoEvent(
                videoId.toString(),
                VideoEvent.EventType.VIDEO_UPLOAD_COMPLETED,
                null,
                Map.of("stagingKey", video.stagingKey(), "sha256Hex", computedSha256Hex,
                        "ownerId", video.ownerId())));

        LOGGER.info("Finalised upload videoId={} sha256={}", videoId, computedSha256Hex);
        return saved;
    }

    // -------------------------------------------------------------------------
    // HEAD — offset query
    // -------------------------------------------------------------------------

    /**
     * Returns the current byte offset for an in-progress upload session.
     */
    public long getUploadOffset(UUID videoId, String uploaderId) {
        findAndAuthorise(videoId, uploaderId);
        String raw = redisTemplate.opsForValue().get(OFFSET_KEY_PREFIX + videoId);
        return raw != null ? Long.parseLong(raw) : 0L;
    }

    // -------------------------------------------------------------------------
    // DELETE (cancel upload)
    // -------------------------------------------------------------------------

    /**
     * Cancels an in-progress upload: deletes the staging object and marks DELETED.
     */
    public void cancelUpload(UUID videoId, String uploaderId) {
        Video video = findAndAuthorise(videoId, uploaderId);
        requireStatus(video, VideoStatus.UPLOADING);

        // Clean up the local staging file (the file in S3 hasn't been created yet
        // because finaliseUpload is the only thing that writes to S3).
        localStagingStore.delete(videoId);

        videoJpaRepository.save(video.withStatus(VideoStatus.DELETED));
        videoJpaRepository.saveHistory(
                VideoStatusHistory.record(videoId, VideoStatus.UPLOADING, VideoStatus.DELETED, uploaderId, "cancelled by uploader"));

        decrementConcurrentSessions(uploaderId);
        redisTemplate.delete(OFFSET_KEY_PREFIX + videoId);

        LOGGER.info("Cancelled upload videoId={} uploader={}", videoId, uploaderId);
    }

    // -------------------------------------------------------------------------
    // User DELETE (soft-delete PUBLISHED video)
    // -------------------------------------------------------------------------

    /**
     * Soft-deletes a PUBLISHED video. Only the original uploader may call this.
     */
    public Video deleteVideo(UUID videoId, String uploaderId) {
        Video video = findAndAuthorise(videoId, uploaderId);
        if (video.status() != VideoStatus.PUBLISHED) {
            throw new VideoModerationException(
                    "Video " + videoId + " is not PUBLISHED, cannot delete. Current status: " + video.status());
        }

        Video deleted = video.withStatus(VideoStatus.DELETED);
        Video saved = videoJpaRepository.save(deleted);
        videoJpaRepository.saveHistory(
                VideoStatusHistory.record(videoId, VideoStatus.PUBLISHED, VideoStatus.DELETED, uploaderId, "deleted by owner"));

        LOGGER.info("Soft-deleted videoId={} by uploader={}", videoId, uploaderId);
        return saved;
    }

    // -------------------------------------------------------------------------
    // Appeal
    // -------------------------------------------------------------------------

    /**
     * Submits an appeal for a REJECTED video. Only the original uploader may call this.
     */
    public Video submitAppeal(UUID videoId, String uploaderId, String appealReason) {
        if (appealReason == null || appealReason.isBlank()) {
            throw new IllegalArgumentException("appeal reason must not be blank");
        }
        Video video = findAndAuthorise(videoId, uploaderId);
        if (video.status() != VideoStatus.REJECTED) {
            throw new VideoModerationException(
                    "Video " + videoId + " is not REJECTED, cannot appeal. Current status: " + video.status());
        }
        // Spec MED-3: 7-day grace period for appeals from moderation timestamp.
        if (video.moderatedAt() == null
                || Duration.between(video.moderatedAt(), Instant.now()).toDays() > 7) {
            throw new VideoValidationException(
                    "appeal_window_expired",
                    "Appeal window of 7 days has expired for video " + videoId);
        }

        Video appealed = video.withAppeal();
        Video saved = videoJpaRepository.save(appealed);
        videoJpaRepository.saveHistory(
                VideoStatusHistory.record(videoId, VideoStatus.REJECTED, VideoStatus.APPEAL_PENDING, uploaderId, appealReason));

        videoEventPublisherPort.publish(new VideoEvent(
                videoId.toString(),
                VideoEvent.EventType.VIDEO_APPEAL_SUBMITTED,
                null,
                Map.of("appealReason", appealReason, "ownerId", video.ownerId())));

        LOGGER.info("Appeal submitted videoId={} uploader={}", videoId, uploaderId);
        return saved;
    }

    // -------------------------------------------------------------------------
    // Stuck-video reaper
    // -------------------------------------------------------------------------

    /**
     * Scheduled every 1 minute. Marks videos stuck in UPLOADING/TRANSCODING/MODERATING
     * for longer than {@link #STUCK_VIDEO_THRESHOLD} as FAILED.
     * DELETED is reserved for user-initiated deletions only.
     */
    @Scheduled(fixedDelay = 60_000)
    public void reaperSweep() {
        Instant cutoff = Instant.now().minus(STUCK_VIDEO_THRESHOLD);
        var stuckVideos = videoJpaRepository.findStuckVideos(cutoff);
        for (Video stuck : stuckVideos) {
            LOGGER.warn("Reaper: marking stuck video {} (status={}) as FAILED", stuck.videoId(), stuck.status());
            videoJpaRepository.save(stuck.withStatus(VideoStatus.FAILED));
            videoJpaRepository.saveHistory(VideoStatusHistory.record(
                    stuck.videoId(), stuck.status(), VideoStatus.FAILED, "reaper", "stuck > 10 min"));
            decrementConcurrentSessions(stuck.ownerId());
            localStagingStore.delete(stuck.videoId());
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Video findAndAuthorise(UUID videoId, String uploaderId) {
        Video video = videoJpaRepository.findById(videoId)
                .orElseThrow(() -> new VideoNotFoundException("Video not found: " + videoId));
        if (!video.ownerId().equals(uploaderId)) {
            throw new VideoNotFoundException("Video not found: " + videoId);
        }
        return video;
    }

    private void requireStatus(Video video, VideoStatus expected) {
        if (video.status() != expected) {
            throw new VideoModerationException(
                    "Video " + video.videoId() + " must be in " + expected + " but is " + video.status());
        }
    }

    private void enforceRateLimit(String uploaderId) {
        String key = RATE_LIMIT_KEY_PREFIX + uploaderId;
        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1) {
            redisTemplate.expire(key, Duration.ofSeconds(1));
        }
        if (count != null && count > 3) {
            throw new VideoUploadRateLimitException("Upload rate limit exceeded. Max 3 POST per second.");
        }
    }

    private void enforceConcurrentSessionLimit(String uploaderId) {
        String key = CONCURRENT_KEY_PREFIX + uploaderId;
        String raw = redisTemplate.opsForValue().get(key);
        long active = raw != null ? Long.parseLong(raw) : 0L;
        if (active >= MAX_CONCURRENT_SESSIONS) {
            throw new VideoUploadRateLimitException(
                    "Max " + MAX_CONCURRENT_SESSIONS + " concurrent upload sessions exceeded.");
        }
    }

    private void enforceFileSizeLimit(long contentLength, VideoOwnerType ownerType) {
        long maxBytes = ownerType == VideoOwnerType.REVIEW ? MAX_REVIEW_VIDEO_BYTES : MAX_PRODUCT_VIDEO_BYTES;
        if (contentLength > maxBytes) {
            throw new IllegalArgumentException(
                    "Declared file size " + contentLength + " exceeds maximum " + maxBytes
                            + " bytes for " + ownerType + " videos.");
        }
    }

    private void enforceQuotas(String uploaderId, VideoOwnerType ownerType, UUID ownerId) {
        long todayCount = videoJpaRepository.countUploaderVideosToday(uploaderId);
        if (todayCount >= MAX_VIDEOS_PER_DAY) {
            throw new VideoQuotaExceededException("Daily upload quota of " + MAX_VIDEOS_PER_DAY + " videos exceeded.");
        }

        if (ownerType == VideoOwnerType.PRODUCT) {
            long productCount = videoJpaRepository.countActiveVideosForProduct(ownerId);
            if (productCount >= MAX_VIDEOS_PER_PRODUCT) {
                throw new VideoQuotaExceededException(
                        "Product video quota of " + MAX_VIDEOS_PER_PRODUCT + " videos exceeded.");
            }
        } else { // REVIEW
            long reviewCount = videoJpaRepository.countActiveVideosForReview(ownerId);
            if (reviewCount >= MAX_VIDEOS_PER_REVIEW) {
                throw new VideoQuotaExceededException(
                        "Review video quota of " + MAX_VIDEOS_PER_REVIEW + " video exceeded.");
            }
        }
    }

    private void validateMagicBytes(byte[] chunkData) {
        if (chunkData == null || chunkData.length < 12) {
            throw new VideoValidationException("First chunk too small to validate magic bytes.");
        }
        // MP4/MOV: bytes 4-7 == "ftyp"
        byte[] ftyp = Arrays.copyOfRange(chunkData, 4, 8);
        if (Arrays.equals(ftyp, MAGIC_MP4_MOV)) {
            return;
        }
        // MKV/WebM: bytes 0-3 == 0x1A 0x45 0xDF 0xA3
        byte[] ebml = Arrays.copyOfRange(chunkData, 0, 4);
        if (Arrays.equals(ebml, MAGIC_MKV)) {
            return;
        }
        // RIFF/WebM container
        byte[] riff = Arrays.copyOfRange(chunkData, 0, 4);
        if (Arrays.equals(riff, MAGIC_RIFF)) {
            return;
        }
        throw new VideoValidationException(
                "File format not allowed. Supported: MP4, MOV, MKV, WebM.");
    }

    private void decrementConcurrentSessions(String uploaderId) {
        String key = CONCURRENT_KEY_PREFIX + uploaderId;
        Long remaining = redisTemplate.opsForValue().decrement(key);
        if (remaining != null && remaining <= 0) {
            redisTemplate.delete(key);
        }
    }
}
