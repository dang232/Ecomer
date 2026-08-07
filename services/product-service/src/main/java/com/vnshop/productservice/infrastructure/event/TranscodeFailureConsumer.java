package com.vnshop.productservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.productservice.application.video.VideoUploadService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class TranscodeFailureConsumer {
    private final ObjectMapper objectMapper;
    private final VideoUploadService videoUploadService;

    public TranscodeFailureConsumer(ObjectMapper objectMapper, VideoUploadService videoUploadService) {
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is required");
        this.videoUploadService = Objects.requireNonNull(videoUploadService, "videoUploadService is required");
    }

    @KafkaListener(topics = "video.transcode.failed", groupId = "product-service-video-transcode-failures")
    public void consume(String rawEvent) {
        try {
            JsonNode event = objectMapper.readTree(rawEvent);
            UUID videoId = UUID.fromString(event.path("videoId").asText());
            String reason = event.path("errorMessage").asText("transcoding failed");
            videoUploadService.markTranscodeFailed(videoId, reason);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Invalid video.transcode.failed event", exception);
        }
    }
}
