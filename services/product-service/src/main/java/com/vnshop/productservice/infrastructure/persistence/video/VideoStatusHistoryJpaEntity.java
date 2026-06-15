package com.vnshop.productservice.infrastructure.persistence.video;

import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.VideoStatusHistory;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "product_svc", name = "video_status_history")
public class VideoStatusHistoryJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "video_id", nullable = false, columnDefinition = "uuid")
    private UUID videoId;

    @Column(name = "from_status", length = 32)
    private String fromStatus;

    @Column(name = "to_status", nullable = false, length = 32)
    private String toStatus;

    @Column(name = "actor_id")
    private String actorId;

    @Column(name = "reason", length = 500)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected VideoStatusHistoryJpaEntity() {
    }

    static VideoStatusHistoryJpaEntity fromDomain(VideoStatusHistory history) {
        VideoStatusHistoryJpaEntity entity = new VideoStatusHistoryJpaEntity();
        entity.videoId = history.videoId();
        entity.fromStatus = history.fromStatus() != null ? history.fromStatus().name() : null;
        entity.toStatus = history.toStatus().name();
        entity.actorId = history.changedBy();
        entity.reason = history.reason();
        entity.createdAt = history.changedAt();
        return entity;
    }
}
