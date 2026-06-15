package com.vnshop.transcoder.consumer;

import com.vnshop.transcoder.model.TranscodeJob;
import com.vnshop.transcoder.model.TranscodeResult;
import com.vnshop.transcoder.producer.TranscodeEventProducer;
import com.vnshop.transcoder.service.TranscodeException;
import com.vnshop.transcoder.service.TranscodeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Consumes {@code video.upload.completed} events and drives the full
 * transcode pipeline.  Manual acknowledgement ensures the offset is only
 * committed after a successful upload to the staging bucket.
 *
 * <p>On exhausted retries the consumer emits a {@code video.transcode.failed}
 * event and acknowledges the record so it is not reprocessed.  The DLT
 * ({@code video.upload.completed.DLT}) is handled separately by the
 * Spring Kafka dead-letter publishing infrastructure.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TranscodeEventConsumer {

    private final TranscodeService        transcodeService;
    private final TranscodeEventProducer  transcodeEventProducer;

    @KafkaListener(
            topics = "video.upload.completed",
            groupId = "transcoder-worker",
            containerFactory = "transcodeKafkaListenerContainerFactory"
    )
    public void consume(ConsumerRecord<String, TranscodeJob> record, Acknowledgment ack) {
        TranscodeJob job = record.value();
        log.info("Received video.upload.completed videoId={} productId={}",
                job.videoId(), job.productId());

        try {
            TranscodeResult result = transcodeService.transcode(job);
            transcodeEventProducer.emitCompleted(result);
            ack.acknowledge();
            log.info("Transcode succeeded videoId={}", job.videoId());

        } catch (TranscodeException e) {
            // @Retryable exhausted — emit failure event, ack to avoid requeue
            log.error("Transcode failed after retries videoId={}: {}", job.videoId(), e.getMessage(), e);
            TranscodeResult failed = TranscodeResult.builder()
                    .videoId(job.videoId())
                    .productId(job.productId())
                    .sellerId(job.sellerId())
                    .success(false)
                    .errorMessage(e.getMessage())
                    .completedAt(Instant.now())
                    .build();
            transcodeEventProducer.emitFailed(failed);
            ack.acknowledge();

        } catch (Exception e) {
            // Unexpected error — do not ack; let Kafka retry or route to DLT
            log.error("Unexpected error processing videoId={}", job.videoId(), e);
            // Not acknowledging will cause redelivery up to max.poll.interval.ms
        }
    }
}
