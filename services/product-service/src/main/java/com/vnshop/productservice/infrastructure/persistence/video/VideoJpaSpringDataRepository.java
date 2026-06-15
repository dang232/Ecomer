package com.vnshop.productservice.infrastructure.persistence.video;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface VideoJpaSpringDataRepository extends JpaRepository<VideoJpaEntity, UUID> {

    Page<VideoJpaEntity> findByStatus(String status, Pageable pageable);

    List<VideoJpaEntity> findByStatusInAndUpdatedAtBefore(List<String> statuses, Instant cutoff);

    long countByUploaderIdAndCreatedAtAfter(String uploaderId, Instant since);

    long countByOwnerTypeAndOwnerIdAndCreatedAtAfter(String ownerType, UUID ownerId, Instant since);
}
