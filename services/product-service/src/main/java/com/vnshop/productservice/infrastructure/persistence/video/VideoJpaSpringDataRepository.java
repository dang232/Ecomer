package com.vnshop.productservice.infrastructure.persistence.video;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VideoJpaSpringDataRepository extends JpaRepository<VideoJpaEntity, UUID> {

    Page<VideoJpaEntity> findByStatus(String status, Pageable pageable);

    @Query(value = "SELECT v.* FROM product_svc.videos v WHERE v.status = :status ORDER BY v.created_at ASC, v.video_id ASC", nativeQuery = true)
    List<VideoJpaEntity> findCursorFirst(@Param("status") String status, Pageable pageable);

    @Query(value = "SELECT v.* FROM product_svc.videos v WHERE v.status = :status AND (v.created_at > :anchorCreatedAt OR (v.created_at = :anchorCreatedAt AND v.video_id > :anchorVideoId)) ORDER BY v.created_at ASC, v.video_id ASC", nativeQuery = true)
    List<VideoJpaEntity> findCursorAfter(@Param("status") String status, @Param("anchorCreatedAt") Instant anchorCreatedAt,
            @Param("anchorVideoId") UUID anchorVideoId, Pageable pageable);

    List<VideoJpaEntity> findByStatusInAndUpdatedAtBefore(List<String> statuses, Instant cutoff);

    long countByUploaderIdAndCreatedAtAfter(String uploaderId, Instant since);

    long countByOwnerTypeAndOwnerIdAndCreatedAtAfter(String ownerType, UUID ownerId, Instant since);

    List<VideoJpaEntity> findByOwnerTypeAndOwnerIdAndStatusOrderByCreatedAtDesc(String ownerType, UUID ownerId, String status);
}
