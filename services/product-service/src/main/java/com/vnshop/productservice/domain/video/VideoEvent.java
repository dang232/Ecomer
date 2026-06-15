package com.vnshop.productservice.domain.video;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;

public record VideoEvent(
        String videoId,
        EventType eventType,
        Instant timestamp,
        Map<String, Object> payload
) {
    public VideoEvent {
        requireNonBlank(videoId, "videoId");
        Objects.requireNonNull(eventType, "eventType is required");
        timestamp = timestamp == null ? Instant.now() : timestamp;
        payload = payload == null ? Map.of() : Map.copyOf(payload);
    }

    public enum EventType {
        // Emitted by product-service when an upload session completes successfully.
        VIDEO_UPLOAD_COMPLETED,
        VIDEO_PUBLISHED,
        VIDEO_REJECTED,
        VIDEO_APPEAL_SUBMITTED
        // NOTE: video.transcode.failed and video.moderation.failed are emitted directly
        // by the transcoder/moderator workers via their own KafkaTemplate — they do not
        // flow through this product-service-side event. The boundary is intentional:
        // the transcoder owns its failure topic to keep product-service decoupled from
        // pipeline-internal events.
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
