package com.vnshop.productservice.application.video;

import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoEvent;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.VideoStatusHistory;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import com.vnshop.productservice.domain.video.port.out.VideoRepositoryPort;
import com.vnshop.productservice.domain.video.port.out.VideoCursorAnchor;
import com.vnshop.productservice.domain.port.out.ObjectStoragePort;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.net.URI;
import java.util.Map;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Application service for admin video moderation.
 * Handles the moderation queue, preview URLs, approve/reject, and appeal flows.
 */
public class VideoAdminService {

    private final VideoRepositoryPort videoRepositoryPort;
    private final ObjectStoragePort objectStoragePort;
    private final VideoEventPublisherPort videoEventPublisherPort;
    private final String publicBucket;

    public VideoAdminService(VideoRepositoryPort videoRepositoryPort,
            ObjectStoragePort objectStoragePort,
            VideoEventPublisherPort videoEventPublisherPort,
            String publicBucket) {
        this.videoRepositoryPort = Objects.requireNonNull(videoRepositoryPort, "videoRepositoryPort is required");
        this.objectStoragePort = Objects.requireNonNull(objectStoragePort, "objectStoragePort is required");
        this.videoEventPublisherPort = Objects.requireNonNull(videoEventPublisherPort, "videoEventPublisherPort is required");
        if (publicBucket == null || publicBucket.isBlank()) {
            throw new IllegalArgumentException("public video bucket is required");
        }
        this.publicBucket = publicBucket;
    }

    /** Returns paginated videos with status PENDING_REVIEW, sorted by createdAt ascending. */
    public Page<Video> getModerationQueue(Pageable pageable) {
        return videoRepositoryPort.findByStatus(VideoStatus.PENDING_REVIEW, pageable);
    }

    /** Returns a short-lived presigned URL for the admin to preview the staged video. */
    public URI getPreviewUrl(UUID videoId) {
        Video video = findOrThrow(videoId);
        String previewKey = mediaSourceKey(video);
        if (previewKey == null) {
            throw new VideoNotFoundException("Video " + videoId + " has no staging file");
        }
        return objectStoragePort.getSignedDownloadUrl(
                previewKey,
                com.vnshop.productservice.domain.storage.ObjectStorageClass.VIDEO_STAGING);
    }

    /**
     * Approves a video in PENDING_REVIEW status. Use {@link #approveAppeal} for
     * APPEAL_PENDING videos. The two flows share the same publishing work, so
     * both delegate to {@link #doApprove}.
     */
    public Video approve(UUID videoId, String adminId) {
        Video video = findOrThrow(videoId);
        if (video.status() != VideoStatus.PENDING_REVIEW) {
            throw new VideoModerationException(
                    "Video " + videoId + " is not in PENDING_REVIEW status, current: " + video.status());
        }
        return doApprove(video, adminId);
    }

    /**
     * Rejects a video: updates DB to REJECTED with reason, emits video.rejected,
     * records history. The staging file is retained for 7 days (cleaned up by scheduler).
     */
    public Video reject(UUID videoId, String adminId, String reason) {
        Objects.requireNonNull(reason, "rejection reason is required");
        if (reason.isBlank()) {
            throw new IllegalArgumentException("rejection reason must not be blank");
        }

        Video video = findOrThrow(videoId);
        if (video.status() != VideoStatus.PENDING_REVIEW && video.status() != VideoStatus.APPEAL_PENDING) {
            throw new VideoModerationException(
                    "Video " + videoId + " cannot be rejected in status: " + video.status());
        }

        Video rejected = video.withRejection(adminId, reason);
        Video saved = videoRepositoryPort.save(rejected);

        videoRepositoryPort.saveHistory(
                VideoStatusHistory.record(videoId, video.status(), VideoStatus.REJECTED, adminId, reason));

        videoEventPublisherPort.publish(new VideoEvent(
                videoId.toString(),
                VideoEvent.EventType.VIDEO_REJECTED,
                null,
                Map.of("reason", reason, "ownerId", video.ownerId())));

        return saved;
    }

    /** Returns paginated videos with status APPEAL_PENDING. */
    public Page<Video> getAppealsQueue(Pageable pageable) {
        return videoRepositoryPort.findByStatus(VideoStatus.APPEAL_PENDING, pageable);
    }

    public List<Video> getCursorQueue(VideoStatus status, VideoCursorAnchor anchor, int limit) {
        return videoRepositoryPort.findByStatusCursor(status, anchor, limit + 1);
    }

    /**
     * Approves a video appeal (APPEAL_PENDING). H8 fix: explicit state guard
     * prevents the prior recursive call to {@link #approve}, which would have
     * silently re-validated the status a second time. Both flows now share
     * {@link #doApprove} for the publishing work but each owns its state check.
     */
    public Video approveAppeal(UUID videoId, String adminId) {
        Video video = findOrThrow(videoId);
        if (video.status() != VideoStatus.APPEAL_PENDING) {
            throw new VideoModerationException(
                    "Video " + videoId + " is not in APPEAL_PENDING status, current: " + video.status());
        }
        return doApprove(video, adminId);
    }

    /**
     * Shared approve work: copy staging → public bucket, save as PUBLISHED,
     * emit video.published, record history. Idempotent at the call site: if
     * called with a video already in PUBLISHED status, the {@code save} will
     * overwrite with a duplicate (acceptable since the operation is naturally
     * idempotent at the storage layer — publicKey is the same).
     */
    private Video doApprove(Video video, String adminId) {
        UUID videoId = video.videoId();
        String sourceVideoKey = mediaSourceKey(video);
        if (sourceVideoKey == null) {
            throw new VideoNotFoundException("Video " + videoId + " has no processed staging file");
        }
        String publicKey = publicKeyFor(sourceVideoKey);
        String sourcePosterKey = video.posterKey();
        String publicPosterKey = sourcePosterKey == null ? null : publicKeyFor(sourcePosterKey);

        // Copy staging → public bucket then remove from staging
        objectStoragePort.copyObject(sourceVideoKey, publicKey);
        objectStoragePort.deleteObject(sourceVideoKey);
        if (sourcePosterKey != null) {
            objectStoragePort.copyObject(sourcePosterKey, publicPosterKey);
            objectStoragePort.deleteObject(sourcePosterKey);
        }

        Video approved = video.withApproval(adminId, publicKey, publicPosterKey);
        Video saved = videoRepositoryPort.save(approved);

        videoRepositoryPort.saveHistory(
                VideoStatusHistory.record(videoId, video.status(), VideoStatus.PUBLISHED, adminId, null));

        videoEventPublisherPort.publish(new VideoEvent(
                videoId.toString(),
                VideoEvent.EventType.VIDEO_PUBLISHED,
                null,
                Map.of("publicKey", publicKey, "ownerId", video.ownerId())));

        return saved;
    }

    private String mediaSourceKey(Video video) {
        return video.processedKey() != null ? video.processedKey() : video.stagingKey();
    }

    private String publicKeyFor(String bucketPrefixedKey) {
        int separator = bucketPrefixedKey.indexOf('/');
        String objectKey = separator >= 0 ? bucketPrefixedKey.substring(separator + 1) : bucketPrefixedKey;
        return publicBucket + "/" + objectKey;
    }

    /** Final rejection of a video appeal. */
    public Video rejectAppeal(UUID videoId, String adminId, String reason) {
        Video video = findOrThrow(videoId);
        if (video.status() != VideoStatus.APPEAL_PENDING) {
            throw new VideoModerationException(
                    "Video " + videoId + " is not in APPEAL_PENDING status, current: " + video.status());
        }
        return reject(videoId, adminId, reason);
    }

    private Video findOrThrow(UUID videoId) {
        return videoRepositoryPort.findById(videoId)
                .orElseThrow(() -> new VideoNotFoundException("Video not found: " + videoId));
    }
}
