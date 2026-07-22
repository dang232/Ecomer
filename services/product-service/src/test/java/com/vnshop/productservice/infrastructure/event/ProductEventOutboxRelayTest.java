package com.vnshop.productservice.infrastructure.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ProductEventPublisherPort;
import com.vnshop.productservice.infrastructure.persistence.ProductEventOutboxJpaEntity;
import com.vnshop.productservice.infrastructure.persistence.ProductEventOutboxSpringDataRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.support.SendResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SuppressWarnings("unchecked")
class ProductEventOutboxRelayTest {
    @Test
    void retainsOutboxRowForRetryWhenKafkaAcknowledgementFails() throws Exception {
        ProductEventOutboxSpringDataRepository repository = mock(ProductEventOutboxSpringDataRepository.class);
        ProductEventPublisherPort publisher = mock(ProductEventPublisherPort.class);
        ProductEventOutboxJpaEntity row = row();
        when(repository.findRetryable(any(), any())).thenReturn(List.of(row));
        CompletableFuture<SendResult<String, ProductEvent>> failed = new CompletableFuture<>();
        failed.completeExceptionally(new RuntimeException("broker unavailable"));
        when(publisher.publish(any())).thenReturn(failed);

        relay(repository, publisher).publishPending();

        assertThat(row.getPublishedAt()).isNull();
        assertThat(row.getAttemptCount()).isEqualTo(1);
        verify(repository).save(row);
    }

    @Test
    void marksOutboxRowPublishedAfterKafkaAcknowledgement() throws Exception {
        ProductEventOutboxSpringDataRepository repository = mock(ProductEventOutboxSpringDataRepository.class);
        ProductEventPublisherPort publisher = mock(ProductEventPublisherPort.class);
        ProductEventOutboxJpaEntity row = row();
        when(repository.findRetryable(any(), any())).thenReturn(List.of(row));
        when(publisher.publish(any())).thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        relay(repository, publisher).publishPending();

        assertThat(row.getPublishedAt()).isNotNull();
        verify(repository).save(row);
    }

    private static ProductEventOutboxRelay relay(ProductEventOutboxSpringDataRepository repository,
            ProductEventPublisherPort publisher) {
        return new ProductEventOutboxRelay(repository, publisher, new ObjectMapper().findAndRegisterModules(), 50, 8, 50);
    }

    private static ProductEventOutboxJpaEntity row() throws Exception {
        ProductEvent event = new ProductEvent("product-1", ProductEvent.EventType.UPDATED, Instant.now(),
                Map.of("name", "Phone", "status", "ACTIVE"));
        return new ProductEventOutboxJpaEntity(event.productId(),
                new ObjectMapper().findAndRegisterModules().writeValueAsString(event));
    }
}
