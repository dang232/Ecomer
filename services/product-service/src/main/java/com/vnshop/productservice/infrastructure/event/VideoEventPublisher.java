package com.vnshop.productservice.infrastructure.event;

import com.vnshop.productservice.domain.video.VideoEvent;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Publishes {@link VideoEvent} records to Kafka.
 *
 * <p>H9 fix: send failures are now logged at ERROR level (was WARN) with a
 * stable marker prefix so that log-based alerts can fire reliably. A
 * {@code video.event.publish.failed} counter is also exposed via Micrometer
 * for metric-based alerting. The match {@code ProductEventPublisher} still
 * swallows errors at WARN — that will be addressed in a follow-up that
 * fixes both publishers together; the rationale is documented in
 * {@code docs/superpowers/specs/2026-06-15-video-pipeline-quality-pass.md}.
 *
 * <p>Note: we deliberately do not rethrow because the surrounding transaction
 * (e.g. {@code VideoUploadService.finaliseUpload}) has already committed the
 * database state. Throwing here would not undo the save — it would only
 * surface an error to the caller after the fact. The intended recovery
 * mechanism is the alert + outbox reconciliation (out of scope for this PR).
 */
@Component
public class VideoEventPublisher implements VideoEventPublisherPort {
    private static final Logger LOGGER = LoggerFactory.getLogger(VideoEventPublisher.class);
    private static final String DEFAULT_TOPIC = "video-events";
    private static final String UPLOAD_COMPLETED_TOPIC = "video.upload.completed";
    static final String ALERT_MARKER = "[VIDEO-EVENT-PUBLISH-FAILED]";

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final Counter publishFailureCounter;

    public VideoEventPublisher(KafkaTemplate<String, Object> kafkaTemplate,
            MeterRegistry meterRegistry) {
        this.kafkaTemplate = kafkaTemplate;
        this.publishFailureCounter = Counter.builder("video.event.publish.failed")
                .description("Count of video events that failed to publish to Kafka")
                .register(meterRegistry);
    }

    @Override
    public void publish(VideoEvent event) {
        LOGGER.info("Publishing video event {} for video {}", event.eventType(), event.videoId());
        try {
            kafkaTemplate.send(topicFor(event), event.videoId(), messageFor(event));
        } catch (RuntimeException exception) {
            // H9: log at ERROR with a stable marker for log-based alerts, and
            // increment a metric counter. We do NOT rethrow — see class javadoc.
            publishFailureCounter.increment();
            LOGGER.error("{} videoId={} eventType={} error={}",
                    ALERT_MARKER, event.videoId(), event.eventType(), exception.getMessage(), exception);
        }
    }

    private static String topicFor(VideoEvent event) {
        return event.eventType() == VideoEvent.EventType.VIDEO_UPLOAD_COMPLETED
                ? UPLOAD_COMPLETED_TOPIC
                : DEFAULT_TOPIC;
    }

    private static Object messageFor(VideoEvent event) {
        if (event.eventType() != VideoEvent.EventType.VIDEO_UPLOAD_COMPLETED) {
            return event;
        }

        Map<String, Object> payload = event.payload();
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("videoId", event.videoId());
        message.put("ownerType", payload.get("ownerType"));
        message.put("productId", blankToNull(payload.get("productId")));
        message.put("reviewId", blankToNull(payload.get("reviewId")));
        message.put("rawKey", payload.get("rawKey"));
        message.put("extension", payload.get("extension"));
        message.put("sha256", payload.get("sha256"));
        message.put("fileSizeBytes", payload.get("fileSizeBytes"));
        return message;
    }

    private static Object blankToNull(Object value) {
        return value instanceof String text && text.isBlank() ? null : value;
    }
}
