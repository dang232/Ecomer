package com.vnshop.paymentservice.infrastructure.event;

import com.vnshop.paymentservice.domain.PaymentCallbackOutboxRecord;
import com.vnshop.paymentservice.domain.port.out.PaymentCallbackOutbox;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PaymentCallbackOutboxRelayTest {

    @Test
    @SuppressWarnings("unchecked")
    void publishesEveryUnpublishedRowAndMarksPublished() {
        InMemoryOutbox outbox = new InMemoryOutbox();
        outbox.savePending("PAYPAL", "order-1");
        outbox.savePending("VNPAY", "order-2");
        outbox.savePending("MOMO", "order-3");
        KafkaTemplate<String, Object> kafkaTemplate = mock(KafkaTemplate.class);
        when(kafkaTemplate.send(any(String.class), any(String.class), any()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        PaymentCallbackOutboxRelay relay = relay(outbox, kafkaTemplate);
        relay.publishPending();

        verify(kafkaTemplate).send(eq(PaymentCallbackOutboxRelay.TOPIC), eq("order-1"), any(PaymentCompletedEvent.class));
        verify(kafkaTemplate).send(eq(PaymentCallbackOutboxRelay.TOPIC), eq("order-2"), any(PaymentCompletedEvent.class));
        verify(kafkaTemplate).send(eq(PaymentCallbackOutboxRelay.TOPIC), eq("order-3"), any(PaymentCompletedEvent.class));
        assertThat(outbox.publishedIds).containsExactlyInAnyOrder(1L, 2L, 3L);
    }

    @Test
    @SuppressWarnings("unchecked")
    void leavesRowUnpublishedWhenSendThrows() {
        InMemoryOutbox outbox = new InMemoryOutbox();
        outbox.savePending("PAYPAL", "order-1");
        KafkaTemplate<String, Object> kafkaTemplate = mock(KafkaTemplate.class);
        when(kafkaTemplate.send(any(String.class), any(String.class), any()))
                .thenThrow(new RuntimeException("kafka down"));

        PaymentCallbackOutboxRelay relay = relay(outbox, kafkaTemplate);
        relay.publishPending();

        assertThat(outbox.publishedIds).isEmpty();
    }

    @Test
    @SuppressWarnings("unchecked")
    void noOpWhenKafkaTemplateAbsent() {
        InMemoryOutbox outbox = new InMemoryOutbox();
        outbox.savePending("PAYPAL", "order-1");
        ObjectProvider<KafkaTemplate<String, Object>> empty = mock(ObjectProvider.class);
        when(empty.getIfAvailable()).thenReturn(null);

        PaymentCallbackOutboxRelay relay = new PaymentCallbackOutboxRelay(outbox, empty, 50, 50);
        relay.publishPending();

        assertThat(outbox.publishedIds).isEmpty();
    }

    @Test
    @SuppressWarnings("unchecked")
    void respectsBatchSize() {
        InMemoryOutbox outbox = new InMemoryOutbox();
        for (int i = 0; i < 5; i++) {
            outbox.savePending("PAYPAL", "order-" + i);
        }
        KafkaTemplate<String, Object> kafkaTemplate = mock(KafkaTemplate.class);
        when(kafkaTemplate.send(any(String.class), any(String.class), any()))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        PaymentCallbackOutboxRelay relay = new PaymentCallbackOutboxRelay(outbox, providerOf(kafkaTemplate), 2, 50);
        relay.publishPending();

        verify(kafkaTemplate, times(2)).send(any(String.class), any(String.class), any());
        assertThat(outbox.publishedIds).hasSize(2);
    }

    @Test
    @SuppressWarnings("unchecked")
    void leavesRowRetryableWhenKafkaAcknowledgementFails() {
        InMemoryOutbox outbox = new InMemoryOutbox();
        outbox.savePending("PAYPAL", "order-1");
        KafkaTemplate<String, Object> kafkaTemplate = mock(KafkaTemplate.class);
        CompletableFuture<SendResult<String, Object>> failed = new CompletableFuture<>();
        failed.completeExceptionally(new RuntimeException("broker rejected record"));
        when(kafkaTemplate.send(any(String.class), any(String.class), any())).thenReturn(failed);

        relay(outbox, kafkaTemplate).publishPending();

        assertThat(outbox.publishedIds).isEmpty();
        assertThat(outbox.failureAttempts).containsEntry(1L, 1);
    }

    @Test
    @SuppressWarnings("unchecked")
    void leavesRowRetryableWhenKafkaAcknowledgementTimesOut() {
        InMemoryOutbox outbox = new InMemoryOutbox();
        outbox.savePending("PAYPAL", "order-1");
        KafkaTemplate<String, Object> kafkaTemplate = mock(KafkaTemplate.class);
        when(kafkaTemplate.send(any(String.class), any(String.class), any())).thenReturn(new CompletableFuture<>());

        new PaymentCallbackOutboxRelay(outbox, providerOf(kafkaTemplate), 50, 1).publishPending();

        assertThat(outbox.publishedIds).isEmpty();
        assertThat(outbox.failureAttempts).containsEntry(1L, 1);
    }

    private static PaymentCallbackOutboxRelay relay(
            InMemoryOutbox outbox, KafkaTemplate<String, Object> kafkaTemplate) {
        return new PaymentCallbackOutboxRelay(outbox, providerOf(kafkaTemplate), 50, 50);
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<KafkaTemplate<String, Object>> providerOf(KafkaTemplate<String, Object> template) {
        ObjectProvider<KafkaTemplate<String, Object>> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(template);
        return provider;
    }

    private static final class InMemoryOutbox implements PaymentCallbackOutbox {
        private final Map<Long, PaymentCallbackOutboxRecord> rows = new HashMap<>();
        private final Set<Long> publishedIds = new HashSet<>();
        private final Map<Long, Integer> failureAttempts = new HashMap<>();
        private long nextId = 1;

        void savePending(String provider, String orderId) {
            long id = nextId++;
            rows.put(id, new PaymentCallbackOutboxRecord(
                    id, provider, UUID.randomUUID(), orderId, "ref-" + id, "COMPLETED",
                    new BigDecimal("10000"), "VND", UUID.randomUUID(), "evt-" + id, "hash-" + id,
                    Instant.now(), null, null, null, null, null, 0));
        }

        @Override
        public PaymentCallbackOutboxRecord save(PaymentCallbackOutboxRecord record) {
            rows.put(record.id(), record);
            return record;
        }

        @Override
        public List<PaymentCallbackOutboxRecord> findUnpublished(int limit) {
            List<PaymentCallbackOutboxRecord> result = new ArrayList<>();
            for (PaymentCallbackOutboxRecord record : rows.values()) {
                if (record.publishedAt() == null && !publishedIds.contains(record.id())) {
                    result.add(record);
                    if (result.size() == limit) {
                        break;
                    }
                }
            }
            return result;
        }

        @Override
        public void markPublished(Long id) {
            publishedIds.add(id);
        }

        @Override
        public List<PaymentCallbackOutboxRecord> findRetryable(int limit) {
            List<PaymentCallbackOutboxRecord> result = new ArrayList<>();
            for (PaymentCallbackOutboxRecord record : rows.values()) {
                if (record.publishedAt() == null && !publishedIds.contains(record.id())) {
                    result.add(record);
                    if (result.size() == limit) {
                        break;
                    }
                }
            }
            return result;
        }

        @Override
        public void recordFailure(Long id, int attemptCount, String error, java.time.Instant nextAttemptAt, boolean dead) {
            failureAttempts.put(id, attemptCount);
        }
    }
}
