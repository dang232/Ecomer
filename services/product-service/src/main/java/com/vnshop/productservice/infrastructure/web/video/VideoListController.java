package com.vnshop.productservice.infrastructure.web.video;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaEntity;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaSpringDataRepository;

@RestController
@RequestMapping("/api/v1")
public class VideoListController {

    private final VideoJpaSpringDataRepository videoRepo;

    public VideoListController(VideoJpaSpringDataRepository videoRepo) {
        this.videoRepo = videoRepo;
    }

    @GetMapping("/videos")
    public ResponseEntity<Map<String, Object>> listVideos(
            @RequestParam String entityId,
            @RequestParam String context) {

        String ownerType = context.toUpperCase();
        UUID ownerId = UUID.fromString(entityId);

        List<VideoJpaEntity> entities = videoRepo
                .findByOwnerTypeAndOwnerIdAndStatusOrderByCreatedAtDesc(ownerType, ownerId, "PUBLISHED");

        List<Map<String, Object>> videos = entities.stream().map(e -> Map.<String, Object>of(
                "id", e.getVideoId().toString(),
                "entityId", e.getOwnerId().toString(),
                "context", e.getOwnerType(),
                "status", e.getStatus(),
                "playbackUrl", e.getTranscodedObjectKey() != null ? e.getTranscodedObjectKey() : "",
                "thumbnailUrl", e.getPosterObjectKey() != null ? e.getPosterObjectKey() : "",
                "uploadedAt", e.getCreatedAt() != null ? e.getCreatedAt().toString() : "",
                "publishedAt", e.getPublishedAt() != null ? e.getPublishedAt().toString() : ""
        )).toList();

        return ResponseEntity.ok(Map.of("videos", videos));
    }
}
