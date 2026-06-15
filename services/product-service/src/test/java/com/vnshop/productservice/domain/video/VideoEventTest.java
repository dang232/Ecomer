package com.vnshop.productservice.domain.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

class VideoEventTest {

    @Test
    void constructor_setsTimestampToNowWhenNull() {
        Instant before = Instant.now();
        VideoEvent event = new VideoEvent("vid-1", VideoEvent.EventType.VIDEO_PUBLISHED, null, Map.of());
        Instant after = Instant.now();

        assertThat(event.timestamp()).isBetween(before, after);
    }

    @Test
    void constructor_preservesExplicitTimestamp() {
        Instant ts = Instant.parse("2025-01-01T00:00:00Z");
        VideoEvent event = new VideoEvent("vid-1", VideoEvent.EventType.VIDEO_REJECTED, ts, Map.of());

        assertThat(event.timestamp()).isEqualTo(ts);
    }

    @Test
    void constructor_usesEmptyMapWhenPayloadIsNull() {
        VideoEvent event = new VideoEvent("vid-1", VideoEvent.EventType.VIDEO_PUBLISHED, null, null);

        assertThat(event.payload()).isEmpty();
    }

    @Test
    void constructor_defensivelyCopiesPayload() {
        Map<String, Object> payload = new java.util.HashMap<>(Map.of("key", "value"));
        VideoEvent event = new VideoEvent("vid-1", VideoEvent.EventType.VIDEO_PUBLISHED, null, payload);
        payload.put("injected", "extra");

        assertThat(event.payload()).doesNotContainKey("injected");
    }

    @Test
    void constructor_throwsWhenVideoIdIsNull() {
        assertThatThrownBy(() -> new VideoEvent(null, VideoEvent.EventType.VIDEO_PUBLISHED, null, Map.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("videoId");
    }

    @Test
    void constructor_throwsWhenVideoIdIsBlank() {
        assertThatThrownBy(() -> new VideoEvent("  ", VideoEvent.EventType.VIDEO_PUBLISHED, null, Map.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("videoId");
    }

    @Test
    void constructor_throwsWhenEventTypeIsNull() {
        assertThatThrownBy(() -> new VideoEvent("vid-1", null, null, Map.of()))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void payload_carriesReasonForRejectedEvent() {
        VideoEvent event = new VideoEvent(
                "vid-2",
                VideoEvent.EventType.VIDEO_REJECTED,
                null,
                Map.of("reason", "NSFW content", "ownerId", "seller-1"));

        assertThat(event.payload()).containsEntry("reason", "NSFW content");
    }
}
