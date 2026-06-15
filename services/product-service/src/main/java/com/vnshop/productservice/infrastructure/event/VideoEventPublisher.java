package com.vnshop.productservice.infrastructure.event;

import com.vnshop.productservice.domain.video.VideoEvent;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

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
    private static final String TOPIC = "video-events";
    static final String ALERT_MARKER = "[VIDEO-EVENT-PUBLISH-FAILED]";

    private final KafkaTemplate<String, VideoEvent> kafkaTemplate;
    private final Counter publishFailureCounter;

    public VideoEventPublisher(KafkaTemplate<String, VideoEvent> kafkaTemplate,
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
            kafkaTemplate.send(TOPIC, event.videoId(), event);
        } catch (RuntimeException exception) {
            // H9: log at ERROR with a stable marker for log-based alerts, and
            // increment a metric counter. We do NOT rethrow — see class javadoc.
            publishFailureCounter.increment();
            LOGGER.error("{} videoId={} eventType={} error={}",
                    ALERT_MARKER, event.videoId(), event.eventType(), exception.getMessage(), exception);
        }
    }
}
