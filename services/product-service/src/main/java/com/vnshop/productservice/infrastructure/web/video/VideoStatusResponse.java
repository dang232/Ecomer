package com.vnshop.productservice.infrastructure.web.video;

import com.vnshop.productservice.domain.video.Video;

public record VideoStatusResponse(
        String id,
        String status,
        String thumbnailUrl,
        String playbackUrl,
        String rejectionReason
) {
    static VideoStatusResponse fromDomain(Video video) {
        return new VideoStatusResponse(
                video.videoId().toString(),
                video.status().name(),
                null,
                null,
                video.rejectionReason());
    }
}
