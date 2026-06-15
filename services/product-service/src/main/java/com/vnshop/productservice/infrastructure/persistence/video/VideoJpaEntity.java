package com.vnshop.productservice.infrastructure.persistence.video;

import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.infrastructure.persistence.BaseJpaEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "product_svc", name = "videos")
@Getter
@Setter
public class VideoJpaEntity extends BaseJpaEntity {

    @Id
    @Column(name = "video_id", columnDefinition = "uuid")
    private UUID videoId;

    @Column(name = "owner_type", nullable = false, length = 32)
    private String ownerType;

    @Column(name = "owner_id", nullable = false, columnDefinition = "uuid")
    private UUID ownerId;

    @Column(name = "uploader_id", nullable = false)
    private String uploaderId;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "raw_object_key", length = 1024)
    private String rawObjectKey;

    @Column(name = "transcoded_object_key", length = 1024)
    private String transcodedObjectKey;

    @Column(name = "poster_object_key", length = 1024)
    private String posterObjectKey;

    @Column(name = "content_type")
    private String contentType;

    @Column(name = "raw_size_bytes")
    private Long rawSizeBytes;

    @Column(name = "sha256_hex", length = 64)
    private String sha256Hex;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @Column(name = "appeal_reason", length = 1000)
    private String appealReason;

    @Column(name = "moderated_by")
    private String moderatedBy;

    @Column(name = "moderated_at")
    private Instant moderatedAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected VideoJpaEntity() {
    }

    static VideoJpaEntity fromDomain(Video video) {
        VideoJpaEntity entity = new VideoJpaEntity();
        entity.videoId = video.videoId();
        // owner_type is derived from whether productId or reviewId is set
        entity.ownerType = video.productId() != null ? "PRODUCT" : "REVIEW";
        // owner_id is the non-null product or review UUID
        String ownerIdStr = video.productId() != null ? video.productId() : video.reviewId();
        entity.ownerId = ownerIdStr != null ? UUID.fromString(ownerIdStr) : null;
        entity.uploaderId = video.ownerId();
        entity.status = video.status().name();
        entity.rawObjectKey = video.stagingKey();
        entity.transcodedObjectKey = video.publicKey();
        entity.rejectionReason = video.rejectionReason();
        entity.moderatedBy = video.moderatedBy();
        entity.moderatedAt = video.moderatedAt();
        entity.publishedAt = video.publishedAt();
        return entity;
    }

    Video toDomain() {
        String productId = "PRODUCT".equals(ownerType) ? ownerId.toString() : null;
        String reviewId = "REVIEW".equals(ownerType) ? ownerId.toString() : null;
        return new Video(
                videoId,
                uploaderId,
                productId,
                reviewId,
                rawObjectKey,
                transcodedObjectKey,
                VideoStatus.valueOf(status),
                rejectionReason,
                moderatedBy,
                moderatedAt,
                publishedAt,
                getCreatedAt());
    }
}
