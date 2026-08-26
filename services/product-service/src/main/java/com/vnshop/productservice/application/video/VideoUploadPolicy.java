package com.vnshop.productservice.application.video;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import com.vnshop.productservice.domain.video.VideoOwnerType;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaRepository;

import java.time.Duration;
import java.util.Arrays;
import java.util.UUID;

final class VideoUploadPolicy {
    static final long MAX_PRODUCT_VIDEO_BYTES = 500L * 1024 * 1024;
    static final long MAX_REVIEW_VIDEO_BYTES = 200L * 1024 * 1024;
    static final int MAX_VIDEOS_PER_DAY = 10;
    static final int MAX_VIDEOS_PER_PRODUCT = 3;
    static final int MAX_VIDEOS_PER_REVIEW = 1;
    static final int MAX_CONCURRENT_SESSIONS = 2;
    static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);
    static final Duration IDEMPOTENCY_RESERVATION_TTL = Duration.ofSeconds(30);
    static final Duration IDEMPOTENCY_WAIT_TIMEOUT = Duration.ofSeconds(5);
    static final Duration IDEMPOTENCY_POLL_INTERVAL = Duration.ofMillis(10);
    static final Duration UPLOAD_STATE_TTL = Duration.ofHours(2);
    static final Duration CONCURRENT_SESSION_TTL = Duration.ofHours(1);

    private static final byte[] MAGIC_MP4_MOV = new byte[]{0x66, 0x74, 0x79, 0x70};
    private static final byte[] MAGIC_MKV = new byte[]{0x1A, 0x45, (byte) 0xDF, (byte) 0xA3};
    private static final byte[] MAGIC_RIFF = new byte[]{0x52, 0x49, 0x46, 0x46};

    private final VideoJpaRepository videoRepository;
    private final VideoRedisPort videoRedis;
    private final ProductRepositoryPort productRepository;
    private final ReviewRepositoryPort reviewRepository;

    VideoUploadPolicy(VideoJpaRepository videoRepository, VideoRedisPort videoRedis,
            ProductRepositoryPort productRepository, ReviewRepositoryPort reviewRepository) {
        this.videoRepository = videoRepository;
        this.videoRedis = videoRedis;
        this.productRepository = productRepository;
        this.reviewRepository = reviewRepository;
    }

    void authoriseTarget(String uploaderId, VideoOwnerType ownerType, UUID ownerId) {
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

    void enforceCreationLimits(String uploaderId, VideoOwnerType ownerType, UUID ownerId, long contentLength) {
        enforceRateLimit(uploaderId);
        long active = videoRedis.getConcurrentSessions(uploaderId);
        if (active >= MAX_CONCURRENT_SESSIONS) {
            throw new VideoUploadRateLimitException("Max " + MAX_CONCURRENT_SESSIONS + " concurrent upload sessions exceeded.");
        }
        long maxBytes = ownerType == VideoOwnerType.REVIEW ? MAX_REVIEW_VIDEO_BYTES : MAX_PRODUCT_VIDEO_BYTES;
        if (contentLength > maxBytes) {
            throw new IllegalArgumentException("Declared file size " + contentLength + " exceeds maximum "
                    + maxBytes + " bytes for " + ownerType + " videos.");
        }
        enforceQuotas(uploaderId, ownerType, ownerId);
    }

    void validateMagicBytes(byte[] chunkData) {
        if (chunkData == null || chunkData.length < 12) {
            throw new VideoValidationException("First chunk too small to validate magic bytes.");
        }
        if (Arrays.equals(Arrays.copyOfRange(chunkData, 4, 8), MAGIC_MP4_MOV)
                || Arrays.equals(Arrays.copyOfRange(chunkData, 0, 4), MAGIC_MKV)
                || Arrays.equals(Arrays.copyOfRange(chunkData, 0, 4), MAGIC_RIFF)) {
            return;
        }
        throw new VideoValidationException("File format not allowed. Supported: MP4, MOV, MKV, WebM.");
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

    private void enforceQuotas(String uploaderId, VideoOwnerType ownerType, UUID ownerId) {
        if (videoRepository.countUploaderVideosToday(uploaderId) >= MAX_VIDEOS_PER_DAY) {
            throw new VideoQuotaExceededException("Daily upload quota of " + MAX_VIDEOS_PER_DAY + " videos exceeded.");
        }
        if (ownerType == VideoOwnerType.PRODUCT
                && videoRepository.countActiveVideosForProduct(ownerId) >= MAX_VIDEOS_PER_PRODUCT) {
            throw new VideoQuotaExceededException("Product video quota of " + MAX_VIDEOS_PER_PRODUCT + " videos exceeded.");
        }
        if (ownerType == VideoOwnerType.REVIEW
                && videoRepository.countActiveVideosForReview(ownerId) >= MAX_VIDEOS_PER_REVIEW) {
            throw new VideoQuotaExceededException("Review video quota of " + MAX_VIDEOS_PER_REVIEW + " video exceeded.");
        }
    }
}
