package com.vnshop.productservice.application.video;

import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoEvent;
import com.vnshop.productservice.domain.video.VideoOwnerType;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.VideoStatusHistory;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaRepository;
import com.vnshop.productservice.infrastructure.storage.VideoStorageProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
 *
 * <p>The stuck-video reaper has been extracted to {@link VideoReaper} (H3).
 * Redis state has been extracted to {@link VideoRedisPort} (H5).
 */
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

    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);
    private static final Duration IDEMPOTENCY_RESERVATION_TTL = Duration.ofSeconds(30);
    private static final Duration IDEMPOTENCY_WAIT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration IDEMPOTENCY_POLL_INTERVAL = Duration.ofMillis(10);
    private static final Duration UPLOAD_STATE_TTL = Duration.ofHours(2);
    private static final Duration CONCURRENT_SESSION_TTL = Duration.ofHours(1);

    private final VideoJpaRepository videoJpaRepository;
    private final LocalStagingStore localStagingStore;
    private final VideoEventPublisherPort videoEventPublisherPort;
    private final VideoRedisPort videoRedis;
    private final VideoStorageProperties videoStorageProperties;
    private final ProductRepositoryPort productRepository;
    private final ReviewRepositoryPort reviewRepository;
    private final Object[] uploadLocks = new Object[64];

    {
        Arrays.setAll(uploadLocks, ignored -> new Object());
    }

    public VideoUploadService(VideoJpaRepository videoJpaRepository, LocalStagingStore localStagingStore,
            VideoEventPublisherPort videoEventPublisherPort, VideoRedisPort videoRedis,
            VideoStorageProperties videoStorageProperties) {
        this(videoJpaRepository, localStagingStore, videoEventPublisherPort, videoRedis,
                videoStorageProperties, null, null);
    }

    public VideoUploadService(VideoJpaRepository videoJpaRepository, LocalStagingStore localStagingStore,
            VideoEventPublisherPort videoEventPublisherPort, VideoRedisPort videoRedis,
            VideoStorageProperties videoStorageProperties, ProductRepositoryPort productRepository,
            ReviewRepositoryPort reviewRepository) {
        this.videoJpaRepository = videoJpaRepository;
        this.localStagingStore = localStagingStore;
        this.videoEventPublisherPort = videoEventPublisherPort;
        this.videoRedis = videoRedis;
        this.videoStorageProperties = videoStorageProperties;
        this.productRepository = productRepository;
        this.reviewRepository = reviewRepository;
    }

    // -------------------------------------------------------------------------
    // POST — tus Creation
    // -------------------------------------------------------------------------

    public Video createUploadSession(String uploaderId, VideoOwnerType ownerType, UUID ownerId,
            String idempotencyKey, long contentLength) {
        return createUploadSession(uploaderId, ownerType, ownerId, idempotencyKey, contentLength, "mp4");
    }

    public Video createUploadSession(String uploaderId, VideoOwnerType ownerType, UUID ownerId,
            String idempotencyKey, long contentLength, String extension) {
        authorizeTarget(uploaderId, ownerType, ownerId);
        String scopedIdempotencyKey = scopedIdempotencyKey(uploaderId, ownerType, ownerId, idempotencyKey);
        // Spec MED-5: idempotency-key dedup — duplicate POSTs within 24h return existing upload URL.
        UUID videoId = UUID.randomUUID();
        boolean idempotencyClaimed = false;
        if (hasIdempotencyKey(idempotencyKey)) {
            while (!idempotencyClaimed) {
                Video existing = findExistingIdempotentVideo(scopedIdempotencyKey);
                if (existing != null) {
                    return existing;
                }
                idempotencyClaimed = videoRedis.claimIdempotencyKey(
                        scopedIdempotencyKey, videoId.toString(), IDEMPOTENCY_RESERVATION_TTL);
                if (!idempotencyClaimed) {
                    videoId = UUID.randomUUID();
                }
            }
        }

        try {
            enforceRateLimit(uploaderId);
        enforceConcurrentSessionLimit(uploaderId);
        enforceFileSizeLimit(contentLength, ownerType);
        enforceQuotas(uploaderId, ownerType, ownerId);

        String stagingKey = videoStorageProperties.inputBucket() + "/uploads/" + videoId + "." + extension;

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

        videoRedis.incrementConcurrentSessions(uploaderId);
        videoRedis.setConcurrentSessionsTtl(uploaderId, CONCURRENT_SESSION_TTL);

        videoRedis.setOffset(videoId, 0L, UPLOAD_STATE_TTL);
        videoRedis.setTotalSize(videoId, contentLength, UPLOAD_STATE_TTL);

        if (idempotencyClaimed && !videoRedis.completeIdempotencyKey(
                scopedIdempotencyKey, videoId.toString(), IDEMPOTENCY_TTL)) {
            throw new VideoValidationException(
                    "idempotency_claim_lost", "Could not publish the upload idempotency result");
        }

        LOGGER.info("Created upload session videoId={} uploader={} stagingKey={}", videoId, uploaderId, stagingKey);
        return saved;
        } catch (RuntimeException ex) {
            if (idempotencyClaimed) {
                videoRedis.releaseIdempotencyReservation(scopedIdempotencyKey, videoId.toString());
            }
            throw ex;
        }
    }

    // -------------------------------------------------------------------------
    // PATCH — chunk upload
    // -------------------------------------------------------------------------

    private static String scopedIdempotencyKey(
            String uploaderId, VideoOwnerType ownerType, UUID ownerId, String idempotencyKey) {
        return uploaderId + ":" + ownerType.name() + ":" + ownerId + ":" + idempotencyKey;
    }

    private static boolean hasIdempotencyKey(String idempotencyKey) {
        return idempotencyKey != null && !idempotencyKey.isBlank();
    }

    private Video findExistingIdempotentVideo(String scopedIdempotencyKey) {
        long deadline = System.nanoTime() + IDEMPOTENCY_WAIT_TIMEOUT.toNanos();
        while (true) {
            String existingVideoId = videoRedis.getIdempotencyKey(scopedIdempotencyKey);
            if (existingVideoId != null) {
                Video existing = videoJpaRepository.findById(UUID.fromString(existingVideoId)).orElse(null);
                if (existing != null) {
                    LOGGER.info("Idempotency hit: returning existing video {} for key={}",
                            existingVideoId, scopedIdempotencyKey);
                    return existing;
                }
                videoRedis.releaseIdempotencyKeyForVideo(existingVideoId);
                continue;
            }

            if (!videoRedis.hasIdempotencyReservation(scopedIdempotencyKey)) {
                return null;
            }
            if (System.nanoTime() >= deadline) {
                throw new VideoValidationException(
                        "idempotency_in_progress", "Another upload is still being created for this operation");
            }
            try {
                Thread.sleep(IDEMPOTENCY_POLL_INTERVAL.toMillis());
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new VideoValidationException(
                        "idempotency_interrupted", "Upload creation was interrupted while waiting for a retry");
            }
        }
    }

    public long appendChunk(UUID videoId, String uploaderId, long chunkOffset,
            int chunkLength, byte[] chunkData) {
        synchronized (uploadLocks[Math.floorMod(videoId.hashCode(), uploadLocks.length)]) {
            Video video = findAndAuthorise(videoId, uploaderId);
            requireStatus(video, VideoStatus.UPLOADING);

            if (chunkData == null || chunkLength != chunkData.length) {
                throw new VideoValidationException(
                        "invalid_chunk_length", "Declared chunk length must match payload length");
            }

            long currentOffset = videoRedis.getOffset(videoId);
            if (chunkOffset != currentOffset) {
                throw new VideoValidationException(
                        "invalid_upload_offset",
                        "Upload offset must equal the server offset " + currentOffset);
            }

            long declaredTotal = videoRedis.getTotalSize(videoId);
            if (chunkLength > declaredTotal - chunkOffset) {
                throw new VideoValidationException(
                        "chunk_exceeds_upload_length", "Chunk exceeds the declared upload length");
            }

            if (isFirstChunk(chunkOffset)) {
                validateMagicBytes(chunkData);
            }

            long newOffset;
            try {
                newOffset = localStagingStore.writeChunk(videoId, chunkOffset, chunkData, chunkLength);
            } catch (IOException ex) {
                throw new VideoValidationException("staging_write_failed",
                        "Could not write chunk to local staging: " + ex.getMessage());
            }

            videoRedis.setOffset(videoId, newOffset, UPLOAD_STATE_TTL);

            // H4 fix: detect final chunk inside the service using the declared total size
            // so a client crash between PATCH and the next PATCH is fine — the reaper
            // catches truly stuck sessions.
            if (declaredTotal > 0 && newOffset == declaredTotal) {
                finaliseUpload(videoId, uploaderId);
            }

            return newOffset;
        }
    }

    private static final long FIRST_CHUNK_OFFSET = 0L;

    private static boolean isFirstChunk(long chunkOffset) {
        return chunkOffset == FIRST_CHUNK_OFFSET;
    }

    public Video finaliseUpload(UUID videoId, String uploaderId) {
        Video video = findAndAuthorise(videoId, uploaderId);
        requireStatus(video, VideoStatus.UPLOADING);

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

        long fileSizeBytes = videoRedis.getTotalSize(videoId);
        videoJpaRepository.recordRawUpload(videoId, contentTypeFor(video.stagingKey()), fileSizeBytes,
                computedSha256Hex);
        videoRedis.decrementConcurrentSessions(uploaderId);
        videoRedis.deleteOffset(videoId);
        videoRedis.deleteTotalSize(videoId);

        videoEventPublisherPort.publish(new VideoEvent(
                videoId.toString(),
                VideoEvent.EventType.VIDEO_UPLOAD_COMPLETED,
                null,
                Map.of("rawKey", keyWithoutBucket(video.stagingKey()), "extension", extensionFor(video.stagingKey()),
                        "sha256", computedSha256Hex, "fileSizeBytes", fileSizeBytes,
                        "ownerId", video.ownerId(),
                        // M18 fix: include ownerType + productId/reviewId in the payload
                        // so the transcoder can route staging keys per spec section 5.
                        "ownerType", video.productId() != null ? "PRODUCT" : "REVIEW",
                        "productId", video.productId() == null ? "" : video.productId(),
                        "reviewId",  video.reviewId()  == null ? "" : video.reviewId())));

        LOGGER.info("Finalised upload videoId={} sha256={}", videoId, computedSha256Hex);
        return saved;
    }

    private static String keyWithoutBucket(String bucketPrefixedKey) {
        int separator = bucketPrefixedKey.indexOf('/');
        return separator >= 0 ? bucketPrefixedKey.substring(separator + 1) : bucketPrefixedKey;
    }

    private static String extensionFor(String bucketPrefixedKey) {
        int separator = bucketPrefixedKey.lastIndexOf('.');
        return separator >= 0 ? bucketPrefixedKey.substring(separator + 1) : "mp4";
    }

    private static String contentTypeFor(String bucketPrefixedKey) {
        return switch (extensionFor(bucketPrefixedKey)) {
            case "mov" -> "video/quicktime";
            case "webm" -> "video/webm";
            case "mkv" -> "video/x-matroska";
            default -> "video/mp4";
        };
    }

    // -------------------------------------------------------------------------
    // HEAD — offset query
    // -------------------------------------------------------------------------

    public long getUploadOffset(UUID videoId, String uploaderId) {
        findAndAuthorise(videoId, uploaderId);
        return videoRedis.getOffset(videoId);
    }

    public Video getVideoStatus(UUID videoId, String uploaderId) {
        return findAndAuthorise(videoId, uploaderId);
    }

    public void markTranscodeFailed(UUID videoId, String reason) {
        Video video = videoJpaRepository.findById(videoId).orElse(null);
        if (video == null || video.status() == VideoStatus.FAILED
                || video.status() == VideoStatus.PUBLISHED
                || video.status() == VideoStatus.REJECTED
                || video.status() == VideoStatus.DELETED) {
            return;
        }
        videoJpaRepository.save(video.withStatus(VideoStatus.FAILED));
        videoJpaRepository.saveHistory(VideoStatusHistory.record(
                videoId, video.status(), VideoStatus.FAILED, "transcoder", reason));
    }

    // -------------------------------------------------------------------------
    // DELETE (cancel upload)
    // -------------------------------------------------------------------------

    public void cancelUpload(UUID videoId, String uploaderId) {
        Video video = findAndAuthorise(videoId, uploaderId);
        requireStatus(video, VideoStatus.UPLOADING);

        localStagingStore.delete(videoId);

        videoJpaRepository.save(video.withStatus(VideoStatus.DELETED));
        videoJpaRepository.saveHistory(
                VideoStatusHistory.record(videoId, VideoStatus.UPLOADING, VideoStatus.DELETED, uploaderId, "cancelled by uploader"));

        videoRedis.decrementConcurrentSessions(uploaderId);
        videoRedis.deleteOffset(videoId);
        videoRedis.deleteTotalSize(videoId);
        videoRedis.releaseIdempotencyKeyForVideo(videoId.toString());

        LOGGER.info("Cancelled upload videoId={} uploader={}", videoId, uploaderId);
    }

    // -------------------------------------------------------------------------
    // User DELETE (soft-delete PUBLISHED video)
    // -------------------------------------------------------------------------

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

    private void authorizeTarget(String uploaderId, VideoOwnerType ownerType, UUID ownerId) {
        if (ownerType == VideoOwnerType.PRODUCT && productRepository != null) {
            Product product = productRepository.findById(ownerId).orElse(null);
            if (product == null || !uploaderId.equals(product.sellerId())) {
                throw new VideoNotFoundException("Video target not found: " + ownerId);
            }
        }
        if (ownerType == VideoOwnerType.REVIEW && reviewRepository != null) {
            Review review = reviewRepository.findReviewById(ownerId).orElse(null);
            if (review == null || !uploaderId.equals(review.buyerId())) {
                throw new VideoNotFoundException("Video target not found: " + ownerId);
            }
        }
    }

    private void requireStatus(Video video, VideoStatus expected) {
        if (video.status() != expected) {
            throw new VideoModerationException(
                    "Video " + video.videoId() + " must be in " + expected + " but is " + video.status());
        }
    }

    private void enforceRateLimit(String uploaderId) {
        long count = videoRedis.incrementPostRateLimit(uploaderId);
        if (count == 1) {
            videoRedis.setPostRateLimitTtl(uploaderId, Duration.ofSeconds(1));
        }
        if (count > 3) {
            throw new VideoUploadRateLimitException("Upload rate limit exceeded. Max 3 POST per second.");
        }
    }

    private void enforceConcurrentSessionLimit(String uploaderId) {
        long active = videoRedis.getConcurrentSessions(uploaderId);
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
        } else {
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
        byte[] ftyp = Arrays.copyOfRange(chunkData, 4, 8);
        if (Arrays.equals(ftyp, MAGIC_MP4_MOV)) {
            return;
        }
        byte[] ebml = Arrays.copyOfRange(chunkData, 0, 4);
        if (Arrays.equals(ebml, MAGIC_MKV)) {
            return;
        }
        byte[] riff = Arrays.copyOfRange(chunkData, 0, 4);
        if (Arrays.equals(riff, MAGIC_RIFF)) {
            return;
        }
        throw new VideoValidationException(
                "File format not allowed. Supported: MP4, MOV, MKV, WebM.");
    }
}
