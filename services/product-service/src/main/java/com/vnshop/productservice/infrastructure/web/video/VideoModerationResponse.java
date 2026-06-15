package com.vnshop.productservice.infrastructure.web.video;

import com.vnshop.productservice.domain.video.Video;

import java.time.Instant;

public record VideoModerationResponse(
        String videoId,
        String ownerId,
        String productId,
        String reviewId,
        String stagingKey,
        String publicKey,
        String status,
        String rejectionReason,
        String moderatedBy,
        Instant moderatedAt,
        Instant publishedAt,
        Instant createdAt
) {
    public static VideoModerationResponse fromDomain(Video video) {
        return new VideoModerationResponse(
                video.videoId().toString(),
                video.ownerId(),
                video.productId(),
                video.reviewId(),
                video.stagingKey(),
                video.publicKey(),
                video.status().name(),
                video.rejectionReason(),
                video.moderatedBy(),
                video.moderatedAt(),
                video.publishedAt(),
                video.createdAt());
    }
}
