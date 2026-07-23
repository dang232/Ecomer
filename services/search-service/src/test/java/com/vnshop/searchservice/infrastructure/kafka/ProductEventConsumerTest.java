package com.vnshop.searchservice.infrastructure.kafka;

import com.vnshop.searchservice.infrastructure.elasticsearch.ProductElasticsearchRepository;
import com.vnshop.searchservice.infrastructure.elasticsearch.ProductDocument;
import com.vnshop.searchservice.infrastructure.idempotency.ProcessedEventRepository;
import com.vnshop.searchservice.infrastructure.persistence.ProductReadModelRepository;
import com.vnshop.searchservice.infrastructure.persistence.ProductReadModelJpaEntity;
import com.vnshop.searchservice.infrastructure.projection.ProductProjectionRepairRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;

class ProductEventConsumerTest {
    private final ProductReadModelRepository readModels = mock(ProductReadModelRepository.class);
    private final ProcessedEventRepository processedEvents = mock(ProcessedEventRepository.class);
    private final ProductElasticsearchRepository elasticsearch = mock(ProductElasticsearchRepository.class);
    private final ProductProjectionRepairRepository repairs = mock(ProductProjectionRepairRepository.class);
    private final ProductEventConsumer consumer = new ProductEventConsumer(readModels, processedEvents, elasticsearch, repairs);

    @Test
    void queuesRepairAndDoesNotMarkProcessedWhenElasticsearchProjectionFails() {
        ProductEventConsumer.ProductEvent event = event();
        when(processedEvents.existsById(event.deduplicationId())).thenReturn(false);
        when(elasticsearch.save(any())).thenThrow(new IllegalStateException("elasticsearch unavailable"));

        consumer.consume(event);

        verify(readModels).save(any());
        verify(repairs).save(any());
        verify(processedEvents, never()).save(any());
    }

    @Test
    void marksEventProcessedOnlyAfterElasticsearchProjectionSucceeds() {
        ProductEventConsumer.ProductEvent event = event();
        when(processedEvents.existsById(event.deduplicationId())).thenReturn(false);

        consumer.consume(event);

        verify(elasticsearch).save(any());
        verify(processedEvents).save(any());
        verify(repairs, never()).save(any());
    }

    @Test
    void preservesRatingProjectionWhenProductEventDoesNotCarryReviewStats() {
        ProductReadModelJpaEntity previous = new ProductReadModelJpaEntity(
                "product-1", "Phone", null, "electronics", "Acme", "ACTIVE",
                BigDecimal.ONE, BigDecimal.ONE, 4.0f, 1, 1, null, 2,
                Instant.now(), false, false, false);
        ProductDocument previousDocument = new ProductDocument();
        previousDocument.setAverageRating(4.0f);
        previousDocument.setReviewCount(1);
        when(processedEvents.existsById("event-1")).thenReturn(false);
        when(readModels.findById("product-1")).thenReturn(Optional.of(previous));
        when(elasticsearch.findById("product-1")).thenReturn(Optional.of(previousDocument));

        consumer.consume(event());

        ArgumentCaptor<ProductReadModelJpaEntity> readModel = ArgumentCaptor.forClass(ProductReadModelJpaEntity.class);
        verify(readModels).save(readModel.capture());
        assertThat(readModel.getValue().getAverageRating()).isEqualTo(4.0f);
        assertThat(readModel.getValue().getReviewCount()).isEqualTo(1);

        ArgumentCaptor<ProductDocument> document = ArgumentCaptor.forClass(ProductDocument.class);
        verify(elasticsearch).save(document.capture());
        assertThat(document.getValue().getAverageRating()).isEqualTo(4.0f);
        assertThat(document.getValue().getReviewCount()).isEqualTo(1);
    }

    private static ProductEventConsumer.ProductEvent event() {
        return new ProductEventConsumer.ProductEvent("product-1", ProductEventConsumer.ProductEvent.EventType.UPDATED,
                Instant.now(), Map.of("name", "Phone", "status", "ACTIVE"), "event-1");
    }
}
