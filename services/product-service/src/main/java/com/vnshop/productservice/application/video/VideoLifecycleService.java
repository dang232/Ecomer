package com.vnshop.productservice.application.video;

import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoEvent;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.VideoStatusHistory;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaRepository;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

final class VideoLifecycleService {
    private final VideoJpaRepository videoRepository;
    private final LocalStagingStore localStagingStore;
    private final VideoEventPublisherPort eventPublisher;
    private final VideoRedisPort videoRedis;
    private final VideoUploadSupport support;

    VideoLifecycleService(VideoJpaRepository videoRepository, LocalStagingStore localStagingStore,
            VideoEventPublisherPort eventPublisher, VideoRedisPort videoRedis, VideoUploadSupport support) {
        this.videoRepository = videoRepository;
        this.localStagingStore = localStagingStore;
        this.eventPublisher = eventPublisher;
        this.videoRedis = videoRedis;
        this.support = support;
    }

    Video authorise(UUID videoId, String uploaderId) {
        return support.authorise(videoId, uploaderId);
    }

    long getOffset(UUID videoId) {
        return support.getOffset(videoId);
    }

    Video finalise(UUID videoId, String uploaderId) {
        Video video = support.authorise(videoId, uploaderId);
        support.requireStatus(video, VideoStatus.UPLOADING);
        String sha256;
        try {
            sha256 = localStagingStore.putObject(videoId, video.stagingKey());
        } catch (IOException ex) {
            throw new VideoValidationException("staging_finalise_failed",
                    "Could not upload assembled staging file: " + ex.getMessage());
        }
        Video saved = videoRepository.save(video.withStatus(VideoStatus.UPLOADED));
        videoRepository.saveHistory(VideoStatusHistory.record(
                videoId, VideoStatus.UPLOADING, VideoStatus.UPLOADED, uploaderId, null));
        long fileSize = videoRedis.getTotalSize(videoId);
        videoRepository.recordRawUpload(videoId, VideoUploadSupport.contentTypeFor(video.stagingKey()), fileSize, sha256);
        videoRedis.decrementConcurrentSessions(uploaderId);
        videoRedis.deleteOffset(videoId);
        videoRedis.deleteTotalSize(videoId);
        eventPublisher.publish(new VideoEvent(videoId.toString(), VideoEvent.EventType.VIDEO_UPLOAD_COMPLETED, null,
                Map.of("rawKey", VideoUploadSupport.keyWithoutBucket(video.stagingKey()),
                        "extension", VideoUploadSupport.extensionFor(video.stagingKey()), "sha256", sha256,
                        "fileSizeBytes", fileSize, "ownerId", video.ownerId(),
                        "ownerType", video.productId() != null ? "PRODUCT" : "REVIEW",
                        "productId", video.productId() == null ? "" : video.productId(),
                        "reviewId", video.reviewId() == null ? "" : video.reviewId())));
        return saved;
    }

    void markTranscodeFailed(UUID videoId, String reason) {
        Video video = videoRepository.findById(videoId).orElse(null);
        if (video == null || video.status() == VideoStatus.FAILED || video.status() == VideoStatus.PUBLISHED
                || video.status() == VideoStatus.REJECTED || video.status() == VideoStatus.DELETED) {
            return;
        }
        videoRepository.save(video.withStatus(VideoStatus.FAILED));
        videoRepository.saveHistory(VideoStatusHistory.record(
                videoId, video.status(), VideoStatus.FAILED, "transcoder", reason));
    }

    void cancel(UUID videoId, String uploaderId) {
        Video video = support.authorise(videoId, uploaderId);
        support.requireStatus(video, VideoStatus.UPLOADING);
        localStagingStore.delete(videoId);
        videoRepository.save(video.withStatus(VideoStatus.DELETED));
        videoRepository.saveHistory(VideoStatusHistory.record(
                videoId, VideoStatus.UPLOADING, VideoStatus.DELETED, uploaderId, "cancelled by uploader"));
        videoRedis.decrementConcurrentSessions(uploaderId);
        videoRedis.deleteOffset(videoId);
        videoRedis.deleteTotalSize(videoId);
        videoRedis.releaseIdempotencyKeyForVideo(videoId.toString());
    }

    Video delete(UUID videoId, String uploaderId) {
        Video video = support.authorise(videoId, uploaderId);
        if (video.status() != VideoStatus.PUBLISHED) {
            throw new VideoModerationException("Video " + videoId + " is not PUBLISHED, cannot delete. Current status: " + video.status());
        }
        Video saved = videoRepository.save(video.withStatus(VideoStatus.DELETED));
        videoRepository.saveHistory(VideoStatusHistory.record(
                videoId, VideoStatus.PUBLISHED, VideoStatus.DELETED, uploaderId, "deleted by owner"));
        return saved;
    }

    Video submitAppeal(UUID videoId, String uploaderId, String appealReason) {
        if (appealReason == null || appealReason.isBlank()) {
            throw new IllegalArgumentException("appeal reason must not be blank");
        }
        Video video = support.authorise(videoId, uploaderId);
        if (video.status() != VideoStatus.REJECTED) {
            throw new VideoModerationException("Video " + videoId + " is not REJECTED, cannot appeal. Current status: " + video.status());
        }
        if (video.moderatedAt() == null || Duration.between(video.moderatedAt(), Instant.now()).toDays() > 7) {
            throw new VideoValidationException("appeal_window_expired", "Appeal window of 7 days has expired for video " + videoId);
        }
        Video saved = videoRepository.save(video.withAppeal());
        videoRepository.saveHistory(VideoStatusHistory.record(
                videoId, VideoStatus.REJECTED, VideoStatus.APPEAL_PENDING, uploaderId, appealReason));
        eventPublisher.publish(new VideoEvent(videoId.toString(), VideoEvent.EventType.VIDEO_APPEAL_SUBMITTED,
                null, Map.of("appealReason", appealReason, "ownerId", video.ownerId())));
        return saved;
    }
}
