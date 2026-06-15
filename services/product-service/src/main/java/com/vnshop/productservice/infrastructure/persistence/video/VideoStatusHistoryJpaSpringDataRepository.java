package com.vnshop.productservice.infrastructure.persistence.video;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface VideoStatusHistoryJpaSpringDataRepository extends JpaRepository<VideoStatusHistoryJpaEntity, Long> {
}
