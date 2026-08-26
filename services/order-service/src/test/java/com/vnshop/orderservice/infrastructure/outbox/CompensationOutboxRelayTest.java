package com.vnshop.orderservice.infrastructure.outbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.TopicPartition;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

class CompensationOutboxRelayTest {

    @Test
    void publishPendingEvents_marksPublishedOnlyAfterBrokerAcknowledgement() {
        CompensationOutboxRepository repository = mock(CompensationOutboxRepository.class);
        KafkaTemplate<String, String> kafkaTemplate = mock(KafkaTemplate.class);
        CompensationOutboxEventJpaEntity event = CompensationOutboxEventJpaEntity.pending(
                "order-1", "saga-1", "INVENTORY_RELEASE", "op-1",
                "inventory.release-requested", "{\"sagaId\":\"saga-1\"}");
        when(repository.findAndLockPendingEvents(any(Instant.class), org.mockito.ArgumentMatchers.eq(10)))
                .thenReturn(List.of(event));
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenReturn(CompletableFuture.completedFuture(acknowledgedResult()));

        new CompensationOutboxRelay(repository, kafkaTemplate, 10, 3, 100).publishPendingEvents();

        assertThat(event.getStatus()).isEqualTo(CompensationOutboxEvent.Status.PUBLISHED);
        verify(kafkaTemplate).send(any(ProducerRecord.class));
        verify(repository).save(event);
    }

    @Test
    void publishPendingEvents_keepsPendingAndIncrementsAttemptWhenBrokerIsDown() {
        CompensationOutboxRepository repository = mock(CompensationOutboxRepository.class);
        KafkaTemplate<String, String> kafkaTemplate = mock(KafkaTemplate.class);
        CompensationOutboxEventJpaEntity event = CompensationOutboxEventJpaEntity.pending(
                "order-1", "saga-1", "PAYMENT_REFUND", "op-1",
                "payment.refund.requested", "{\"sagaId\":\"saga-1\"}");
        when(repository.findAndLockPendingEvents(any(Instant.class), org.mockito.ArgumentMatchers.eq(10)))
                .thenReturn(List.of(event));
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenReturn(CompletableFuture.failedFuture(new IllegalStateException("broker unavailable")));

        new CompensationOutboxRelay(repository, kafkaTemplate, 10, 3, 100).publishPendingEvents();

        assertThat(event.getStatus()).isEqualTo(CompensationOutboxEvent.Status.PENDING);
        assertThat(event.getAttemptCount()).isEqualTo(1);
        assertThat(event.getLastError()).contains("broker unavailable");
        verify(repository).save(event);
    }

    @Test
    void publishPendingEvents_movesEventToDeadAfterRetryExhaustion() {
        CompensationOutboxRepository repository = mock(CompensationOutboxRepository.class);
        KafkaTemplate<String, String> kafkaTemplate = mock(KafkaTemplate.class);
        CompensationOutboxEventJpaEntity event = CompensationOutboxEventJpaEntity.pending(
                "order-1", "saga-1", "PAYMENT_REFUND", "op-1",
                "payment.refund.requested", "{}");
        when(repository.findAndLockPendingEvents(any(Instant.class), org.mockito.ArgumentMatchers.eq(10)))
                .thenReturn(List.of(event));
        when(kafkaTemplate.send(any(ProducerRecord.class)))
                .thenReturn(CompletableFuture.failedFuture(new IllegalStateException("broker unavailable")));

        CompensationOutboxRelay relay = new CompensationOutboxRelay(repository, kafkaTemplate, 10, 2, 100);
        relay.publishPendingEvents();
        relay.publishPendingEvents();

        assertThat(event.getAttemptCount()).isEqualTo(2);
        assertThat(event.getStatus()).isEqualTo(CompensationOutboxEvent.Status.DEAD);
        assertThat(event.getLastError()).contains("broker unavailable");
        verify(kafkaTemplate, org.mockito.Mockito.times(2)).send(any(ProducerRecord.class));
    }

    private static SendResult<String, String> acknowledgedResult() {
        return new SendResult<>(
                new ProducerRecord<>("inventory.release-requested", "order-1", "payload"),
                new RecordMetadata(new TopicPartition("inventory.release-requested", 0), 0, 0, 0, 0, 0));
    }
}
