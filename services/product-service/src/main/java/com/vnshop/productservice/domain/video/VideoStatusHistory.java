package com.vnshop.productservice.domain.video;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public class VideoStatusHistory {
    private final UUID id;
    private final UUID videoId;
    private final VideoStatus fromStatus;
    private final VideoStatus toStatus;
    private final String changedBy;
    private final String reason;
    private final Instant changedAt;

    public VideoStatusHistory(UUID id, UUID videoId, VideoStatus fromStatus, VideoStatus toStatus,
            String changedBy, String reason, Instant changedAt) {
        this.id = Objects.requireNonNull(id, "id is required");
        this.videoId = Objects.requireNonNull(videoId, "videoId is required");
        this.fromStatus = fromStatus;
        this.toStatus = Objects.requireNonNull(toStatus, "toStatus is required");
        this.changedBy = changedBy;
        this.reason = reason;
        this.changedAt = changedAt == null ? Instant.now() : changedAt;
    }

    public static VideoStatusHistory record(UUID videoId, VideoStatus from, VideoStatus to,
            String changedBy, String reason) {
        return new VideoStatusHistory(UUID.randomUUID(), videoId, from, to, changedBy, reason, Instant.now());
    }

    public UUID id() { return id; }
    public UUID videoId() { return videoId; }
    public VideoStatus fromStatus() { return fromStatus; }
    public VideoStatus toStatus() { return toStatus; }
    public String changedBy() { return changedBy; }
    public String reason() { return reason; }
    public Instant changedAt() { return changedAt; }
}
