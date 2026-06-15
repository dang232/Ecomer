package com.vnshop.transcoder.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;

import java.util.UUID;

/**
 * Payload consumed from the video.upload.completed Kafka topic.
 * Published by product-service after a successful tus upload.
 *
 * <p>Per spec section 5, the staging key is owned by owner type:
 * <ul>
 *   <li>PRODUCT: {@code products/{productId}/videos/{uuid}_720p.mp4}</li>
 *   <li>REVIEW:  {@code reviews/{reviewId}/videos/{uuid}_720p.mp4}</li>
 * </ul>
 * Exactly one of {@code productId} / {@code reviewId} is non-null, matching ownerType.
 */
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public record TranscodeJob(
        UUID videoId,
        /** "PRODUCT" or "REVIEW" — drives the staging key prefix per spec section 5. */
        String ownerType,
        UUID productId,
        UUID reviewId,
        UUID sellerId,
        /** S3/MinIO key in vnshop-video-uploads-tmp bucket */
        String rawKey,
        /** Original file extension (mp4, mov, avi …) */
        String extension,
        /** Expected SHA-256 hex digest of the raw file */
        String sha256,
        long fileSizeBytes
) {
    public TranscodeJob {
        if (ownerType == null || (!ownerType.equals("PRODUCT") && !ownerType.equals("REVIEW"))) {
            throw new IllegalArgumentException("ownerType must be PRODUCT or REVIEW, got: " + ownerType);
        }
        if ("PRODUCT".equals(ownerType) && productId == null) {
            throw new IllegalArgumentException("productId is required when ownerType=PRODUCT");
        }
        if ("REVIEW".equals(ownerType) && reviewId == null) {
            throw new IllegalArgumentException("reviewId is required when ownerType=REVIEW");
        }
    }
}
