package com.vnshop.orderservice.infrastructure.dlt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

class BrokerFailureDltReplayTest {

    @Test
    void storesAnExhaustedRecordOnceWhenTheSameBrokerOffsetIsRedelivered() {
        DurableDltRepository repository = mock(DurableDltRepository.class);
        ConsumerRecord<String, String> record = new ConsumerRecord<>(
                "order.created.DLT", 2, 17L, "order-1", "payload");
        DurableDltJpaEntity existing = entity("order.created.DLT", 2, 17L, "order-1", "payload");
        existing.setId(UUID.randomUUID());
        when(repository.findByTopicAndPartitionAndOffsetAndPayloadHash(
                eq(record.topic()), eq(record.partition()), eq(record.offset()), any(String.class)))
                .thenReturn(Optional.of(existing));

        UUID id = new DurableDltService(repository).store(record, "broker unavailable", 3);

        assertThat(id).isEqualTo(existing.getId());
        verify(repository).findByTopicAndPartitionAndOffsetAndPayloadHash(
                eq("order.created.DLT"), eq(2), eq(17L), any(String.class));
    }

    @Test
    void replaysToTheBaseTopicOnlyAfterKafkaAcknowledgement() throws Exception {
        DurableDltRepository repository = mock(DurableDltRepository.class);
        KafkaTemplate<String, Object> kafka = mock(KafkaTemplate.class);
        UUID id = UUID.randomUUID();
        DurableDltJpaEntity entity = entity("order.created.DLT", 0, 4L, "order-1", "payload");
        entity.setId(id);
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        when(repository.claim(eq(id), any(Instant.class), any(Instant.class))).thenReturn(1);
        when(repository.markReplayed(eq(id), any(Instant.class), any(Instant.class))).thenReturn(1);
        when(kafka.send(org.mockito.ArgumentMatchers.<ProducerRecord<String, Object>>any()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        new DurableDltService(repository).replay(id, kafka);

        verify(kafka).send(eq("order.created"), eq("order-1"), eq("payload"));
        verify(repository).markReplayed(eq(id), any(Instant.class), any(Instant.class));
        assertThat(entity.getReplayedAt()).isNull();
    }

    @Test
    void releasesTheReplayClaimWhenKafkaPublicationFails() {
        DurableDltRepository repository = mock(DurableDltRepository.class);
        KafkaTemplate<String, Object> kafka = mock(KafkaTemplate.class);
        UUID id = UUID.randomUUID();
        DurableDltJpaEntity entity = entity("payment.completed.DLT", 1, 8L, "payment-1", "payload");
        entity.setId(id);
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        when(repository.claim(eq(id), any(Instant.class), any(Instant.class))).thenReturn(1);
        when(kafka.send(org.mockito.ArgumentMatchers.<ProducerRecord<String, Object>>any()))
                .thenReturn(CompletableFuture.failedFuture(new IllegalStateException("broker unavailable")));

        assertThatThrownBy(() -> new DurableDltService(repository).replay(id, kafka))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("DLT replay failed");

        verify(repository).release(eq(id), any(Instant.class));
    }

    private static DurableDltJpaEntity entity(
            String topic, int partition, long offset, String key, String payload) {
        return new DurableDltJpaEntity(
                topic, partition, offset, key, payload, "payload-hash", "broker unavailable", 3, Instant.now());
    }
}
