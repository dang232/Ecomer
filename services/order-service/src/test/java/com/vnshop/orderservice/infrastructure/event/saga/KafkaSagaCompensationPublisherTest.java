package com.vnshop.orderservice.infrastructure.event.saga;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.infrastructure.outbox.CompensationOutboxEventJpaEntity;
import com.vnshop.orderservice.infrastructure.outbox.CompensationOutboxRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class KafkaSagaCompensationPublisherTest {

    @Test
    void publishInventoryReleaseRequested_persistsDurableOperationWithIdempotentFields() throws Exception {
        CompensationOutboxRepository repository = mock(CompensationOutboxRepository.class);
        KafkaSagaCompensationPublisher publisher = new KafkaSagaCompensationPublisher(
                repository, new ObjectMapper());

        publisher.publishInventoryReleaseRequested("order-1", "saga-1");

        ArgumentCaptor<CompensationOutboxEventJpaEntity> event =
                ArgumentCaptor.forClass(CompensationOutboxEventJpaEntity.class);
        verify(repository).insertIfAbsent(event.capture());
        CompensationOutboxEventJpaEntity stored = event.getValue();
        JsonNode payload = new ObjectMapper().readTree(stored.getPayload());

        assertThat(stored.getTopic()).isEqualTo("inventory.release-requested");
        assertThat(stored.getSagaId()).isEqualTo("saga-1");
        assertThat(stored.getStep()).isEqualTo("INVENTORY_RELEASE");
        assertThat(stored.getOperationId()).isEqualTo("saga-1:INVENTORY_RELEASE");
        assertThat(payload.get("sagaId").asText()).isEqualTo("saga-1");
        assertThat(payload.get("step").asText()).isEqualTo("INVENTORY_RELEASE");
        assertThat(payload.get("operationId").asText()).isEqualTo("saga-1:INVENTORY_RELEASE");
        assertThat(payload.get("attempt").asInt()).isZero();
    }

    @Test
    void publishPaymentRefundRequested_includesStableReversalId() throws Exception {
        CompensationOutboxRepository repository = mock(CompensationOutboxRepository.class);
        KafkaSagaCompensationPublisher publisher = new KafkaSagaCompensationPublisher(repository, new ObjectMapper());

        publisher.publishPaymentRefundRequested("order-1", "saga-1");

        ArgumentCaptor<CompensationOutboxEventJpaEntity> event = ArgumentCaptor.forClass(CompensationOutboxEventJpaEntity.class);
        verify(repository).insertIfAbsent(event.capture());
        JsonNode payload = new ObjectMapper().readTree(event.getValue().getPayload());
        assertThat(event.getValue().getTopic()).isEqualTo("payment.refund.requested");
        assertThat(payload.get("reversalId").asText()).isNotBlank();
        assertThat(payload.get("attempt").asInt()).isZero();
    }
}
