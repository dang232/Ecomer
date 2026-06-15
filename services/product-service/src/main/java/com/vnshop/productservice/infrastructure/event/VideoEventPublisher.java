package com.vnshop.productservice.infrastructure.event;

import com.vnshop.productservice.domain.video.VideoEvent;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;

public class VideoEventPublisher implements VideoEventPublisherPort {
    private static final Logger LOGGER = LoggerFactory.getLogger(VideoEventPublisher.class);
    private static final String TOPIC = "video-events";

    private final KafkaTemplate<String, VideoEvent> kafkaTemplate;

    public VideoEventPublisher(KafkaTemplate<String, VideoEvent> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    @Override
    public void publish(VideoEvent event) {
        LOGGER.info("Publishing video event {} for video {}", event.eventType(), event.videoId());
        try {
            kafkaTemplate.send(TOPIC, event.videoId(), event);
        } catch (RuntimeException exception) {
            LOGGER.warn("Video event logged but Kafka publish failed for video {}", event.videoId(), exception);
        }
    }
}
