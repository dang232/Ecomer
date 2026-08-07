package com.vnshop.transcoder.producer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vnshop.transcoder.model.TranscodeResult;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

class TranscodeEventProducerTest {

    @SuppressWarnings("unchecked")
    @Test
    void emitCompletedCompletesOnlyAfterKafkaAcknowledges() {
        KafkaTemplate<String, TranscodeResult> kafkaTemplate = mock(KafkaTemplate.class);
        CompletableFuture<SendResult<String, TranscodeResult>> send = new CompletableFuture<>();
        when(kafkaTemplate.send(eq(TranscodeEventProducer.TOPIC_COMPLETED), any(), any())).thenReturn(send);
        TranscodeEventProducer producer = new TranscodeEventProducer(kafkaTemplate);
        TranscodeResult result = TranscodeResult.builder().videoId(UUID.randomUUID()).success(true).build();

        CompletableFuture<Void> published = producer.emitCompleted(result);

        assertThat(published).isNotCompleted();
        send.complete(mock(SendResult.class));
        assertThat(published).isCompletedWithValue(null);
    }
}
