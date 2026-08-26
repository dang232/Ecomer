package com.vnshop.productservice.application.video;

import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoEvent;
import com.vnshop.productservice.domain.video.VideoOwnerType;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.VideoStatusHistory;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaRepository;
import com.vnshop.productservice.infrastructure.storage.VideoStorageProperties;

import java.time.Instant;
import java.util.UUID;

final class VideoUploadSessionService {
    private final VideoJpaRepository videoRepository;
    private final VideoRedisPort videoRedis;
    private final VideoStorageProperties storageProperties;
    private final VideoUploadPolicy policy;
    private final VideoUploadSupport support;

    VideoUploadSessionService(VideoJpaRepository videoRepository, VideoRedisPort videoRedis,
            VideoStorageProperties storageProperties, VideoUploadPolicy policy, VideoUploadSupport support) {
        this.videoRepository = videoRepository;
        this.videoRedis = videoRedis;
        this.storageProperties = storageProperties;
        this.policy = policy;
        this.support = support;
    }

    Video create(String uploaderId, VideoOwnerType ownerType, UUID ownerId, String idempotencyKey,
            long contentLength, String extension) {
        policy.authoriseTarget(uploaderId, ownerType, ownerId);
        String scopedKey = support.idempotencyKey(uploaderId, ownerType, ownerId, idempotencyKey);
        UUID videoId = UUID.randomUUID();
        boolean claimed = false;
        if (hasIdempotencyKey(idempotencyKey)) {
            while (!claimed) {
                Video existing = support.findExistingIdempotentVideo(scopedKey);
                if (existing != null) {
                    return existing;
                }
                claimed = videoRedis.claimIdempotencyKey(scopedKey, videoId.toString(),
                        VideoUploadPolicy.IDEMPOTENCY_RESERVATION_TTL);
                if (!claimed) {
                    videoId = UUID.randomUUID();
                }
            }
        }
        try {
            policy.enforceCreationLimits(uploaderId, ownerType, ownerId, contentLength);
            String stagingKey = storageProperties.inputBucket() + "/uploads/" + videoId + "." + extension;
            Video video = new Video(videoId, uploaderId,
                    ownerType == VideoOwnerType.PRODUCT ? ownerId.toString() : null,
                    ownerType == VideoOwnerType.REVIEW ? ownerId.toString() : null,
                    stagingKey, null, VideoStatus.UPLOADING, null, null, null, null, Instant.now());
            Video saved = videoRepository.save(video);
            videoRepository.saveHistory(VideoStatusHistory.record(
                    videoId, null, VideoStatus.UPLOADING, uploaderId, "upload created"));
            videoRedis.incrementConcurrentSessions(uploaderId);
            videoRedis.setConcurrentSessionsTtl(uploaderId, VideoUploadPolicy.CONCURRENT_SESSION_TTL);
            videoRedis.setOffset(videoId, 0L, VideoUploadPolicy.UPLOAD_STATE_TTL);
            videoRedis.setTotalSize(videoId, contentLength, VideoUploadPolicy.UPLOAD_STATE_TTL);
            if (claimed && !videoRedis.completeIdempotencyKey(scopedKey, videoId.toString(),
                    VideoUploadPolicy.IDEMPOTENCY_TTL)) {
                throw new VideoValidationException("idempotency_claim_lost", "Could not publish the upload idempotency result");
            }
            return saved;
        } catch (RuntimeException ex) {
            if (claimed) {
                videoRedis.releaseIdempotencyReservation(scopedKey, videoId.toString());
            }
            throw ex;
        }
    }

    private static boolean hasIdempotencyKey(String idempotencyKey) {
        return idempotencyKey != null && !idempotencyKey.isBlank();
    }
}
