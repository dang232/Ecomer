package com.vnshop.orderservice.integration;

import com.vnshop.orderservice.application.saga.SagaOrchestrator;
import com.vnshop.orderservice.domain.saga.SagaStatus;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEventJpaEntity;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEventSpringDataRepository;
import com.vnshop.orderservice.infrastructure.persistence.SagaStateJpaEntity;
import com.vnshop.orderservice.infrastructure.persistence.SagaStateSpringDataRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
@Import(TestcontainersConfig.class)
class SagaRollbackDurabilityIntegrationTest {

    @Autowired
    private SagaOrchestrator sagaOrchestrator;

    @Autowired
    private SagaStateSpringDataRepository sagaStateRepository;

    @Autowired
    private OutboxEventSpringDataRepository outboxEventRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Test
    void sagaStateAndCompensatingOutboxSurviveCheckoutTransactionRollback() {
        String sagaId = UUID.randomUUID().toString();
        String orderId = UUID.randomUUID().toString();

        transactionTemplate.executeWithoutResult(status -> {
            sagaOrchestrator.start(sagaId, orderId);
            sagaOrchestrator.stepCompleted(sagaId, "INVENTORY");
            sagaOrchestrator.compensate(sagaId, "PAYMENT");
            status.setRollbackOnly();
        });

        SagaStateJpaEntity saga = sagaStateRepository.findById(sagaId).orElseThrow();
        assertThat(saga.getCurrentStep()).isEqualTo(SagaStatus.COMPENSATING);

        assertThat(outboxEventRepository.findAll())
                .filteredOn(OutboxEventJpaEntity::getEventType, "SAGA_COMPENSATING")
                .anySatisfy(event -> {
                    assertThat(event.getAggregateType()).isEqualTo("Order");
                    assertThat(event.getAggregateId()).isEqualTo(orderId);
                    assertThat(event.getPayload())
                            .contains("\"sagaId\":", sagaId)
                            .contains("\"orderId\":", orderId)
                            .contains("\"failedStep\":", "PAYMENT");
                });
    }
}
