package com.vnshop.transcoder.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;

import java.util.UUID;

/**
 * Payload consumed from the video.upload.completed Kafka topic.
 * Published by product-service after a successful tus upload.
 */
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public record TranscodeJob(
        UUID videoId,
        UUID productId,
        UUID sellerId,
        /** S3/MinIO key in vnshop-video-uploads-tmp bucket */
        String rawKey,
        /** Original file extension (mp4, mov, avi …) */
        String extension,
        /** Expected SHA-256 hex digest of the raw file */
        String sha256,
        long fileSizeBytes
) {}
