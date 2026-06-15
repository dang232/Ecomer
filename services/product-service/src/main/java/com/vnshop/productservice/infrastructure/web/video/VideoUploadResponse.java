package com.vnshop.productservice.infrastructure.web.video;

import com.vnshop.productservice.domain.video.Video;

import java.time.Instant;

public record VideoUploadResponse(
        String videoId,
        String ownerId,
        String productId,
        String reviewId,
        String stagingKey,
        String status,
        Instant createdAt
) {
    public static VideoUploadResponse fromDomain(Video video) {
        return new VideoUploadResponse(
                video.videoId().toString(),
                video.ownerId(),
                video.productId(),
                video.reviewId(),
                video.stagingKey(),
                video.status().name(),
                video.createdAt());
    }
}
