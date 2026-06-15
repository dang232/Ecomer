package com.vnshop.productservice.domain.video;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public class Video {
    private final UUID videoId;
    private final String ownerId;
    private final String productId;
    private final String reviewId;
    private final String stagingKey;
    private final String publicKey;
    private final VideoStatus status;
    private final String rejectionReason;
    private final String moderatedBy;
    private final Instant moderatedAt;
    private final Instant publishedAt;
    private final Instant createdAt;

    public Video(UUID videoId, String ownerId, String productId, String reviewId,
            String stagingKey, String publicKey, VideoStatus status,
            String rejectionReason, String moderatedBy, Instant moderatedAt,
            Instant publishedAt, Instant createdAt) {
        this.videoId = Objects.requireNonNull(videoId, "videoId is required");
        this.ownerId = Objects.requireNonNull(ownerId, "ownerId is required");
        this.productId = productId;
        this.reviewId = reviewId;
        this.stagingKey = stagingKey;
        this.publicKey = publicKey;
        this.status = Objects.requireNonNull(status, "status is required");
        this.rejectionReason = rejectionReason;
        this.moderatedBy = moderatedBy;
        this.moderatedAt = moderatedAt;
        this.publishedAt = publishedAt;
        this.createdAt = createdAt == null ? Instant.now() : createdAt;
    }

    public Video withStatus(VideoStatus nextStatus) {
        return new Video(videoId, ownerId, productId, reviewId, stagingKey, publicKey,
                nextStatus, rejectionReason, moderatedBy, moderatedAt, publishedAt, createdAt);
    }

    public Video withApproval(String adminId, String resolvedPublicKey) {
        return new Video(videoId, ownerId, productId, reviewId, stagingKey, resolvedPublicKey,
                VideoStatus.PUBLISHED, null, adminId, Instant.now(), Instant.now(), createdAt);
    }

    public Video withRejection(String adminId, String reason) {
        return new Video(videoId, ownerId, productId, reviewId, stagingKey, null,
                VideoStatus.REJECTED, reason, adminId, Instant.now(), null, createdAt);
    }

    public Video withAppeal() {
        return new Video(videoId, ownerId, productId, reviewId, stagingKey, publicKey,
                VideoStatus.APPEAL_PENDING, rejectionReason, moderatedBy, moderatedAt, publishedAt, createdAt);
    }

    public UUID videoId() { return videoId; }
    public String ownerId() { return ownerId; }
    public String productId() { return productId; }
    public String reviewId() { return reviewId; }
    public String stagingKey() { return stagingKey; }
    public String publicKey() { return publicKey; }
    public VideoStatus status() { return status; }
    public String rejectionReason() { return rejectionReason; }
    public String moderatedBy() { return moderatedBy; }
    public Instant moderatedAt() { return moderatedAt; }
    public Instant publishedAt() { return publishedAt; }
    public Instant createdAt() { return createdAt; }
}
