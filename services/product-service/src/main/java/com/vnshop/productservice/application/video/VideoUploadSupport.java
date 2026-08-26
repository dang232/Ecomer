package com.vnshop.productservice.application.video;

import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaRepository;

import java.util.UUID;

final class VideoUploadSupport {
    private final VideoJpaRepository videoRepository;
    private final VideoRedisPort videoRedis;

    VideoUploadSupport(VideoJpaRepository videoRepository, VideoRedisPort videoRedis) {
        this.videoRepository = videoRepository;
        this.videoRedis = videoRedis;
    }

    Video authorise(UUID videoId, String uploaderId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new VideoNotFoundException("Video not found: " + videoId));
        if (!video.ownerId().equals(uploaderId)) {
            throw new VideoNotFoundException("Video not found: " + videoId);
        }
        return video;
    }

    void requireStatus(Video video, VideoStatus expected) {
        if (video.status() != expected) {
            throw new VideoModerationException(
                    "Video " + video.videoId() + " must be in " + expected + " but is " + video.status());
        }
    }

    String idempotencyKey(String uploaderId, com.vnshop.productservice.domain.video.VideoOwnerType ownerType,
            UUID ownerId, String idempotencyKey) {
        return uploaderId + ":" + ownerType.name() + ":" + ownerId + ":" + idempotencyKey;
    }

    Video findExistingIdempotentVideo(String scopedKey) {
        long deadline = System.nanoTime() + VideoUploadPolicy.IDEMPOTENCY_WAIT_TIMEOUT.toNanos();
        while (true) {
            String existingId = videoRedis.getIdempotencyKey(scopedKey);
            if (existingId != null) {
                Video existing = videoRepository.findById(UUID.fromString(existingId)).orElse(null);
                if (existing != null) {
                    return existing;
                }
                videoRedis.releaseIdempotencyKeyForVideo(existingId);
                continue;
            }
            if (!videoRedis.hasIdempotencyReservation(scopedKey)) {
                return null;
            }
            if (System.nanoTime() >= deadline) {
                throw new VideoValidationException(
                        "idempotency_in_progress", "Another upload is still being created for this operation");
            }
            try {
                Thread.sleep(VideoUploadPolicy.IDEMPOTENCY_POLL_INTERVAL.toMillis());
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                throw new VideoValidationException(
                        "idempotency_interrupted", "Upload creation was interrupted while waiting for a retry");
            }
        }
    }

    long getOffset(UUID videoId) {
        return videoRedis.getOffset(videoId);
    }

    static String keyWithoutBucket(String key) {
        int separator = key.indexOf('/');
        return separator >= 0 ? key.substring(separator + 1) : key;
    }

    static String extensionFor(String key) {
        int separator = key.lastIndexOf('.');
        return separator >= 0 ? key.substring(separator + 1) : "mp4";
    }

    static String contentTypeFor(String key) {
        return switch (extensionFor(key)) {
            case "mov" -> "video/quicktime";
            case "webm" -> "video/webm";
            case "mkv" -> "video/x-matroska";
            default -> "video/mp4";
        };
    }
}
