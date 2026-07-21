package com.vnshop.searchservice.infrastructure.kafka;

import com.vnshop.searchservice.infrastructure.elasticsearch.ProductDocument;
import com.vnshop.searchservice.infrastructure.elasticsearch.ProductElasticsearchRepository;
import com.vnshop.searchservice.infrastructure.idempotency.ProcessedEvent;
import com.vnshop.searchservice.infrastructure.idempotency.ProcessedEventRepository;
import com.vnshop.searchservice.infrastructure.persistence.ProductReadModelJpaEntity;
import com.vnshop.searchservice.infrastructure.persistence.ProductReadModelRepository;
import com.vnshop.searchservice.infrastructure.projection.ProductProjectionRepair;
import com.vnshop.searchservice.infrastructure.projection.ProductProjectionRepairRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

@Service
@ConditionalOnProperty(name = "spring.kafka.bootstrap-servers")
public class ProductEventConsumer {
    private static final Logger LOGGER = LoggerFactory.getLogger(ProductEventConsumer.class);

    private final ProductReadModelRepository productReadModelRepository;
    private final ProcessedEventRepository processedEventRepository;
    private final ProductElasticsearchRepository productElasticsearchRepository;
    private final ProductProjectionRepairRepository repairRepository;

    public ProductEventConsumer(
            ProductReadModelRepository productReadModelRepository,
            ProcessedEventRepository processedEventRepository,
            ProductElasticsearchRepository productElasticsearchRepository,
            ProductProjectionRepairRepository repairRepository) {
        this.productReadModelRepository = productReadModelRepository;
        this.processedEventRepository = processedEventRepository;
        this.productElasticsearchRepository = productElasticsearchRepository;
        this.repairRepository = repairRepository;
    }

    @Transactional
    @KafkaListener(topics = "product-events", groupId = "search-service", concurrency = "12")
    public void consume(ProductEvent event) {
        String eventId = event.deduplicationId();
        if (processedEventRepository.existsById(eventId)) {
            LOGGER.info("Skipping duplicate product event {} for product {}", event.eventType(), event.productId());
            return;
        }

        LOGGER.info("Consuming product event {} for product {}", event.eventType(), event.productId());
        if (event.eventType() == ProductEvent.EventType.DELETED) {
            productReadModelRepository.deleteById(event.productId());
            projectOrQueueRepair(event, () -> indexDeleteToElasticsearch(event.productId()));
        } else {
            productReadModelRepository.save(ProductReadModelJpaEntity.fromEvent(event.productId(), event.payload()));
            projectOrQueueRepair(event, () -> indexUpsertToElasticsearch(event.productId(), event.payload()));
        }
    }

    private void projectOrQueueRepair(ProductEvent event, Runnable projection) {
        try {
            projection.run();
            processedEventRepository.save(new ProcessedEvent(
                    event.deduplicationId(), event.eventType().name(), Instant.now()));
        } catch (RuntimeException exception) {
            repairRepository.save(ProductProjectionRepair.from(event));
            LOGGER.warn("Queued search projection repair for eventId={} productId={}: {}",
                    event.deduplicationId(), event.productId(), exception.getMessage());
        }
    }

    private void indexUpsertToElasticsearch(String productId, Map<String, Object> payload) {
        try {
            ProductDocument doc = ProductDocument.fromEvent(productId, payload);
            productElasticsearchRepository.save(doc);
            LOGGER.debug("Indexed product {} into Elasticsearch", productId);
        } catch (Exception ex) {
            // Log and continue — JPA write already succeeded; ES is eventually consistent.
            LOGGER.warn("Failed to index product {} into Elasticsearch: {}", productId, ex.getMessage());
            throw new IllegalStateException("Elasticsearch index projection failed", ex);
        }
    }

    private void indexDeleteToElasticsearch(String productId) {
        try {
            productElasticsearchRepository.deleteById(productId);
            LOGGER.debug("Deleted product {} from Elasticsearch", productId);
        } catch (Exception ex) {
            LOGGER.warn("Failed to delete product {} from Elasticsearch: {}", productId, ex.getMessage());
            throw new IllegalStateException("Elasticsearch delete projection failed", ex);
        }
    }

    public record ProductEvent(String productId, EventType eventType, Instant timestamp, Map<String, Object> payload, String eventId) {
        public ProductEvent {
            payload = payload == null ? Map.of() : Map.copyOf(payload);
        }

        public String deduplicationId() {
            return eventId == null || eventId.isBlank() ? productId + ":" + eventType + ":" + timestamp : eventId;
        }

        public enum EventType {
            CREATED,
            UPDATED,
            DELETED,
            STOCK_CHANGED
        }
    }

}
