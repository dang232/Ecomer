package com.vnshop.transcoder.producer;

import com.vnshop.transcoder.model.TranscodeResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class TranscodeEventProducer {

    static final String TOPIC_COMPLETED = "video.transcode.completed";
    static final String TOPIC_FAILED    = "video.transcode.failed";

    private final KafkaTemplate<String, TranscodeResult> kafkaTemplate;

    public void emitCompleted(TranscodeResult result) {
        String key = result.videoId().toString();
        kafkaTemplate.send(TOPIC_COMPLETED, key, result)
                .whenComplete((r, ex) -> {
                    if (ex != null) {
                        log.error("Failed to emit {} for videoId={}", TOPIC_COMPLETED, key, ex);
                    } else {
                        log.info("Emitted {} videoId={} offset={}",
                                TOPIC_COMPLETED, key,
                                r.getRecordMetadata().offset());
                    }
                });
    }

    public void emitFailed(TranscodeResult result) {
        String key = result.videoId().toString();
        kafkaTemplate.send(TOPIC_FAILED, key, result)
                .whenComplete((r, ex) -> {
                    if (ex != null) {
                        log.error("Failed to emit {} for videoId={}", TOPIC_FAILED, key, ex);
                    } else {
                        log.info("Emitted {} videoId={} offset={}",
                                TOPIC_FAILED, key,
                                r.getRecordMetadata().offset());
                    }
                });
    }
}
