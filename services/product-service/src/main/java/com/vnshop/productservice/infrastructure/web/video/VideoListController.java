package com.vnshop.productservice.infrastructure.web.video;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.infrastructure.web.ApiResponse;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaEntity;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaSpringDataRepository;

@RestController
@RequestMapping
public class VideoListController {

    private final VideoJpaSpringDataRepository videoRepo;
    private final ObjectStoragePort objectStoragePort;

    public VideoListController(VideoJpaSpringDataRepository videoRepo, ObjectStoragePort objectStoragePort) {
        this.videoRepo = videoRepo;
        this.objectStoragePort = objectStoragePort;
    }

    @GetMapping("/videos")
    public ResponseEntity<ApiResponse<Map<String, Object>>> listVideos(
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
                "playbackUrl", publicUrl(e.getTranscodedObjectKey()),
                "thumbnailUrl", publicUrl(e.getPosterObjectKey()),
                "uploadedAt", e.getCreatedAt() != null ? e.getCreatedAt().toString() : "",
                "publishedAt", e.getPublishedAt() != null ? e.getPublishedAt().toString() : ""
        )).toList();

        return ResponseEntity.ok(ApiResponse.ok(Map.of("videos", videos)));
    }

    private String publicUrl(String objectKey) {
        return objectKey == null || objectKey.isBlank() ? "" : objectStoragePort.publicUrl(objectKey).toString();
    }
}
