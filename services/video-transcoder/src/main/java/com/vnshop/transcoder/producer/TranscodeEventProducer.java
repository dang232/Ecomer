package com.vnshop.transcoder.producer;

import com.vnshop.transcoder.model.TranscodeResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Component
@RequiredArgsConstructor
public class TranscodeEventProducer {

    static final String TOPIC_COMPLETED = "video.transcode.completed";
    static final String TOPIC_FAILED    = "video.transcode.failed";

    private final KafkaTemplate<String, TranscodeResult> kafkaTemplate;

    public CompletableFuture<Void> emitCompleted(TranscodeResult result) {
        String key = result.videoId().toString();
        return kafkaTemplate.send(TOPIC_COMPLETED, key, result).whenComplete((r, ex) -> {
                    if (ex != null) {
                        log.error("Failed to emit {} for videoId={}", TOPIC_COMPLETED, key, ex);
                    } else {
                        Object offset = r == null || r.getRecordMetadata() == null
                                ? "unknown"
                                : r.getRecordMetadata().offset();
                        log.info("Emitted {} videoId={} offset={}",
                                TOPIC_COMPLETED, key,
                                offset);
                    }
                }).thenApply(ignored -> null);
    }

    public CompletableFuture<Void> emitFailed(TranscodeResult result) {
        String key = result.videoId().toString();
        return kafkaTemplate.send(TOPIC_FAILED, key, result).whenComplete((r, ex) -> {
                    if (ex != null) {
                        log.error("Failed to emit {} for videoId={}", TOPIC_FAILED, key, ex);
                    } else {
                        Object offset = r == null || r.getRecordMetadata() == null
                                ? "unknown"
                                : r.getRecordMetadata().offset();
                        log.info("Emitted {} videoId={} offset={}",
                                TOPIC_FAILED, key,
                                offset);
                    }
                }).thenApply(ignored -> null);
    }
}
