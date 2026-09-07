package com.vnshop.searchservice.infrastructure.projection;

import com.vnshop.searchservice.infrastructure.elasticsearch.ProductElasticsearchRepository;
import com.vnshop.searchservice.infrastructure.idempotency.ProcessedEventRepository;
import com.vnshop.searchservice.infrastructure.kafka.ProductEventConsumer.ProductEvent;
import com.vnshop.searchservice.infrastructure.persistence.ProductReadModelJpaEntity;
import com.vnshop.searchservice.infrastructure.persistence.ProductReadModelRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProductProjectionRepairJobTest {
    @Test
    void leavesRepairRowUnconsumedWhenElasticsearchRepairFails() {
        ProductProjectionRepairRepository repairs = mock(ProductProjectionRepairRepository.class);
        ProductReadModelRepository readModels = mock(ProductReadModelRepository.class);
        ProductElasticsearchRepository elasticsearch = mock(ProductElasticsearchRepository.class);
        ProcessedEventRepository processedEvents = mock(ProcessedEventRepository.class);
        ProductProjectionRepair repair = ProductProjectionRepair.from(new ProductEvent(
                "product-1", ProductEvent.EventType.DELETED, Instant.now(), Map.of(), "event-1"));
        when(repairs.findAllByOrderByCreatedAtAsc(org.mockito.ArgumentMatchers.any())).thenReturn(List.of(repair));
        org.mockito.Mockito.doThrow(new IllegalStateException("elasticsearch unavailable"))
                .when(elasticsearch).deleteById("product-1");

        ProductProjectionRepairJob job = new ProductProjectionRepairJob(
                repairs, readModels, elasticsearch, processedEvents, 50);

        assertThatThrownBy(job::repairPending).isInstanceOf(IllegalStateException.class);
        verify(repairs, never()).delete(repair);
        verify(processedEvents, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void removesUnresolvableRepairAndContinuesWithLaterValidRepair() {
        ProductProjectionRepairRepository repairs = mock(ProductProjectionRepairRepository.class);
        ProductReadModelRepository readModels = mock(ProductReadModelRepository.class);
        ProductElasticsearchRepository elasticsearch = mock(ProductElasticsearchRepository.class);
        ProcessedEventRepository processedEvents = mock(ProcessedEventRepository.class);
        ProductProjectionRepair corrupt = ProductProjectionRepair.from(new ProductEvent(
                "missing-product", ProductEvent.EventType.UPDATED, Instant.now(), Map.of(), "event-missing"));
        ProductProjectionRepair valid = ProductProjectionRepair.from(new ProductEvent(
                "product-1", ProductEvent.EventType.UPDATED, Instant.now(), Map.of(), "event-1"));
        when(repairs.findAllByOrderByCreatedAtAsc(any())).thenReturn(List.of(corrupt, valid));
        when(readModels.findById("missing-product")).thenReturn(java.util.Optional.empty());
        when(readModels.findById("product-1")).thenReturn(java.util.Optional.of(
                ProductReadModelJpaEntity.fromEvent("product-1", Map.of("name", "Headphones"))));

        ProductProjectionRepairJob job = new ProductProjectionRepairJob(
                repairs, readModels, elasticsearch, processedEvents, 50);

        job.repairPending();

        verify(repairs).delete(corrupt);
        verify(repairs).delete(valid);
        verify(elasticsearch).save(argThat(document -> "product-1".equals(document.getId())));
        verify(processedEvents).save(argThat(event -> "event-1".equals(event.getEventId())));
        assertThat(corrupt.getProductId()).isEqualTo("missing-product");
    }
}
