package com.vnshop.transcoder.model;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

/**
 * Outcome emitted to video.transcode.completed or video.transcode.failed.
 */
@Builder
public record TranscodeResult(
        UUID videoId,
        UUID productId,
        UUID sellerId,
        boolean success,
        /** S3/MinIO key in vnshop-videos-staging (set on success) */
        String transcodedKey,
        /** S3/MinIO key for the generated poster image (set on success) */
        String posterKey,
        /** Duration of the transcoded video in seconds (set on success) */
        Long durationSeconds,
        /** Human-readable failure reason (set on failure) */
        String errorMessage,
        Instant completedAt
) {}
