package com.vnshop.productservice.infrastructure.persistence.video;

import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.VideoStatusHistory;
import com.vnshop.productservice.domain.video.port.out.VideoRepositoryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class VideoJpaRepository implements VideoRepositoryPort {

    private final VideoJpaSpringDataRepository videoRepo;
    private final VideoStatusHistoryJpaSpringDataRepository historyRepo;

    @Override
    public Optional<Video> findById(UUID videoId) {
        return videoRepo.findById(videoId).map(VideoJpaEntity::toDomain);
    }

    @Override
    public Page<Video> findByStatus(VideoStatus status, Pageable pageable) {
        return videoRepo.findByStatus(status.name(), pageable).map(VideoJpaEntity::toDomain);
    }

    @Override
    public Video save(Video video) {
        VideoJpaEntity entity = videoRepo.findById(video.videoId())
                .orElseGet(() -> VideoJpaEntity.fromDomain(video));
        entity.setStatus(video.status().name());
        entity.setRawObjectKey(video.stagingKey());
        if (video.processedKey() != null || video.publicKey() != null) {
            entity.setTranscodedObjectKey(video.processedKey() != null ? video.processedKey() : video.publicKey());
        }
        if (video.posterKey() != null) {
            entity.setPosterObjectKey(video.posterKey());
        }
        entity.setRejectionReason(video.rejectionReason());
        entity.setModeratedBy(video.moderatedBy());
        entity.setModeratedAt(video.moderatedAt());
        entity.setPublishedAt(video.publishedAt());
        return videoRepo.save(entity).toDomain();
    }

    public void recordRawUpload(UUID videoId, String contentType, long sizeBytes, String sha256Hex) {
        VideoJpaEntity entity = videoRepo.findById(videoId)
                .orElseThrow(() -> new IllegalStateException("Video not found: " + videoId));
        entity.setContentType(contentType);
        entity.setRawSizeBytes(sizeBytes);
        entity.setSha256Hex(sha256Hex);
        videoRepo.save(entity);
    }

    @Override
    public void saveHistory(VideoStatusHistory history) {
        historyRepo.save(VideoStatusHistoryJpaEntity.fromDomain(history));
    }

    /** Count videos uploaded by this user today (for the 10/day quota). */
    public long countUploaderVideosToday(String uploaderId) {
        Instant startOfDay = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.DAYS);
        return videoRepo.countByUploaderIdAndCreatedAtAfter(uploaderId, startOfDay);
    }

    /** Count non-deleted videos attached to a product (for the 3/product quota). */
    public long countActiveVideosForProduct(UUID productId) {
        return countActiveVideosForOwner("PRODUCT", productId);
    }

    /** Count non-deleted videos attached to a review (for the 1/review quota). */
    public long countActiveVideosForReview(UUID reviewId) {
        return countActiveVideosForOwner("REVIEW", reviewId);
    }

    private long countActiveVideosForOwner(String ownerType, UUID ownerId) {
        Instant epoch = Instant.EPOCH;
        return videoRepo.countByOwnerTypeAndOwnerIdAndCreatedAtAfter(ownerType, ownerId, epoch);
    }

    /** Find videos stuck in terminal-processing statuses for longer than the given cutoff. */
    public List<Video> findStuckVideos(Instant updatedBefore) {
        List<String> stuckStatuses = List.of(
                VideoStatus.UPLOADING.name(),
                VideoStatus.TRANSCODING.name(),
                VideoStatus.MODERATING.name());
        return videoRepo.findByStatusInAndUpdatedAtBefore(stuckStatuses, updatedBefore)
                .stream()
                .map(VideoJpaEntity::toDomain)
                .toList();
    }
}
