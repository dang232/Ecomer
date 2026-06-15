package com.vnshop.productservice.infrastructure.event;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.domain.video.VideoEvent;

import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Map;

@SuppressWarnings("unchecked")
class VideoEventPublisherTest {

    private final KafkaTemplate<String, VideoEvent> kafkaTemplate = mock(KafkaTemplate.class);
    private final VideoEventPublisher publisher = new VideoEventPublisher(kafkaTemplate);

    @Test
    void publish_sendsEventToVideoEventsTopic() {
        VideoEvent event = new VideoEvent(
                "vid-1",
                VideoEvent.EventType.VIDEO_PUBLISHED,
                null,
                Map.of("ownerId", "seller-1"));

        publisher.publish(event);

        verify(kafkaTemplate).send(eq("video-events"), eq("vid-1"), eq(event));
    }

    @Test
    void publish_sendsRejectedEventWithReason() {
        VideoEvent event = new VideoEvent(
                "vid-2",
                VideoEvent.EventType.VIDEO_REJECTED,
                null,
                Map.of("reason", "NSFW content", "ownerId", "seller-2"));

        publisher.publish(event);

        verify(kafkaTemplate).send(eq("video-events"), eq("vid-2"), eq(event));
    }

    @Test
    void publish_doesNotThrowWhenKafkaFails() {
        when(kafkaTemplate.send(any(), any(), any()))
                .thenThrow(new RuntimeException("Broker down"));

        VideoEvent event = new VideoEvent(
                "vid-3",
                VideoEvent.EventType.VIDEO_PUBLISHED,
                null,
                Map.of());

        assertThatCode(() -> publisher.publish(event)).doesNotThrowAnyException();
    }

    @Test
    void publish_usesVideoIdAsKafkaMessageKey() {
        String videoId = "vid-key-test";
        VideoEvent event = new VideoEvent(
                videoId,
                VideoEvent.EventType.VIDEO_APPEAL_SUBMITTED,
                null,
                Map.of());

        publisher.publish(event);

        verify(kafkaTemplate).send(any(), eq(videoId), any());
    }
}
