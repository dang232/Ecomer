package com.vnshop.searchservice.infrastructure.kafka;

import com.vnshop.searchservice.infrastructure.elasticsearch.ProductElasticsearchRepository;
import com.vnshop.searchservice.infrastructure.idempotency.ProcessedEventRepository;
import com.vnshop.searchservice.infrastructure.persistence.ProductReadModelRepository;
import com.vnshop.searchservice.infrastructure.projection.ProductProjectionRepairRepository;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    private static ProductEventConsumer.ProductEvent event() {
        return new ProductEventConsumer.ProductEvent("product-1", ProductEventConsumer.ProductEvent.EventType.UPDATED,
                Instant.now(), Map.of("name", "Phone", "status", "ACTIVE"), "event-1");
    }
}
