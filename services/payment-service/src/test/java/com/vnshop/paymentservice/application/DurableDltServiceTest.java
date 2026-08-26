package com.vnshop.paymentservice.application;

import com.vnshop.paymentservice.infrastructure.dlt.DurableDltReplayTransactions;
import com.vnshop.paymentservice.infrastructure.dlt.DurableDltService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.inOrder;
import static org.mockito.ArgumentMatchers.eq;

import com.vnshop.paymentservice.infrastructure.persistence.DurableDltJpaEntity;
import com.vnshop.paymentservice.infrastructure.persistence.DurableDltRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.mockito.InOrder;

class DurableDltServiceTest {
    @Test
    void storesDuplicateSourceRecordOnlyOnce() {
        DurableDltRepository repository = mock(DurableDltRepository.class);
        DurableDltService service = new DurableDltService(repository);
        ConsumerRecord<String, String> record = new ConsumerRecord<>("payment.webhooks.dlt", 2, 9L, "key", "payload");
        DurableDltJpaEntity existing = new DurableDltJpaEntity("payment.webhooks.dlt", 2, 9L, "key", "payload",
                "hash", "reason", 3, Instant.now());
        when(repository.findByTopicAndPartitionAndOffsetAndPayloadHash(any(), any(Integer.class), any(Long.class), any()))
                .thenReturn(Optional.of(existing));

        assertThat(service.store(record, "reason", 3)).isNotNull();
        verify(repository, never()).save(any());
    }

    @Test
    void claimsReplayBeforePublishingAndMarksItAfterKafkaAcknowledges() throws Exception {
        DurableDltRepository repository = mock(DurableDltRepository.class);
        KafkaTemplate<String, Object> kafka = mock(KafkaTemplate.class);
        DurableDltReplayTransactions transactions = mock(DurableDltReplayTransactions.class);
        UUID id = UUID.randomUUID();
        DurableDltJpaEntity entity = new DurableDltJpaEntity("payment.webhooks.dlt", 0, 1L, "key", "payload",
                "hash", "reason", 3, Instant.now());
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        when(transactions.claim(any(), any(), any())).thenReturn(true);
        when(transactions.markReplayed(any(), any(), any())).thenReturn(true);
        when(kafka.send(any(String.class), any(String.class), any()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        new DurableDltService(repository, transactions).replay(id, kafka);

        verify(transactions).claim(any(), any(), any());
        verify(kafka).send("payment.webhooks.retry", "key", "payload");
        verify(transactions).markReplayed(any(), any(), any());
        InOrder order = inOrder(transactions, kafka);
        order.verify(transactions).claim(any(), any(), any());
        order.verify(kafka).send(any(String.class), any(String.class), any());
        order.verify(transactions).markReplayed(any(), any(), any());
    }

    @Test
    void releasesCommittedClaimWhenKafkaRejectsPublication() {
        DurableDltRepository repository = mock(DurableDltRepository.class);
        DurableDltReplayTransactions transactions = mock(DurableDltReplayTransactions.class);
        KafkaTemplate<String, Object> kafka = mock(KafkaTemplate.class);
        UUID id = UUID.randomUUID();
        DurableDltJpaEntity entity = new DurableDltJpaEntity("payment.webhooks.dlt", 0, 1L, "key", "payload",
                "hash", "reason", 3, Instant.now());
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        when(transactions.claim(any(), any(), any())).thenReturn(true);
        CompletableFuture<SendResult<String, Object>> failed = new CompletableFuture<>();
        failed.completeExceptionally(new IllegalStateException("broker unavailable"));
        when(kafka.send(any(String.class), any(String.class), any())).thenReturn(failed);

        assertThatThrownBy(() -> new DurableDltService(repository, transactions).replay(id, kafka))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("DLT replay publication failed");

        verify(transactions).release(eq(id), any());
        verify(transactions, never()).markReplayed(any(), any(), any());
    }

    @Test
    void concurrentReplayPublishesOnlyAfterOneDatabaseClaimWins() throws Exception {
        DurableDltRepository repository = mock(DurableDltRepository.class);
        DurableDltReplayTransactions transactions = mock(DurableDltReplayTransactions.class);
        KafkaTemplate<String, Object> kafka = mock(KafkaTemplate.class);
        UUID id = UUID.randomUUID();
        DurableDltJpaEntity entity = new DurableDltJpaEntity("payment.webhooks.dlt", 0, 1L, "key", "payload",
                "hash", "reason", 3, Instant.now());
        when(repository.findById(id)).thenReturn(Optional.of(entity));
        AtomicBoolean claimed = new AtomicBoolean();
        when(transactions.claim(any(), any(), any())).thenAnswer(invocation -> claimed.compareAndSet(false, true));
        when(transactions.markReplayed(any(), any(), any())).thenReturn(true);
        when(kafka.send(any(String.class), any(String.class), any()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));
        DurableDltService service = new DurableDltService(repository, transactions);

        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = workers.submit(() -> service.replay(id, kafka));
            Future<?> second = workers.submit(() -> service.replay(id, kafka));
            first.get();
            second.get();
        } finally {
            workers.shutdownNow();
        }

        verify(kafka).send("payment.webhooks.retry", "key", "payload");
        verify(transactions).markReplayed(any(), any(), any());
    }
}
