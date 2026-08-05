package com.vnshop.productservice.infrastructure.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.domain.video.VideoEvent;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Map;

@SuppressWarnings("unchecked")
class VideoEventPublisherTest {

    private final KafkaTemplate kafkaTemplate = mock(KafkaTemplate.class);
    private final MeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final VideoEventPublisher publisher = new VideoEventPublisher(kafkaTemplate, meterRegistry);

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
    void publish_routesCompletedUploadsToTheTranscoderTopic() {
        VideoEvent event = new VideoEvent(
                "vid-upload-1",
                VideoEvent.EventType.VIDEO_UPLOAD_COMPLETED,
                null,
                Map.of("ownerType", "PRODUCT", "rawKey", "uploads/vid-upload-1.mp4"));

        publisher.publish(event);

        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(kafkaTemplate).send(eq("video.upload.completed"), eq("vid-upload-1"), payload.capture());
        assertThat(payload.getValue())
                .isInstanceOf(Map.class)
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("videoId", "vid-upload-1")
                .containsEntry("ownerType", "PRODUCT")
                .containsEntry("rawKey", "uploads/vid-upload-1.mp4");
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
    void publish_incrementsFailureCounterOnKafkaError() {
        when(kafkaTemplate.send(any(), any(), any()))
                .thenThrow(new RuntimeException("Broker down"));

        VideoEvent event = new VideoEvent(
                "vid-counter",
                VideoEvent.EventType.VIDEO_PUBLISHED,
                null,
                Map.of());

        publisher.publish(event);

        double count = meterRegistry.counter("video.event.publish.failed").count();
        assertThatCode(() -> { double c = count; })
                .doesNotThrowAnyException();
        // Assert: counter incremented at least once
        org.assertj.core.api.Assertions.assertThat(count).isGreaterThanOrEqualTo(1.0);
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
