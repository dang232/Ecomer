package com.vnshop.searchservice.infrastructure.projection;

import com.vnshop.searchservice.infrastructure.elasticsearch.ProductDocument;
import com.vnshop.searchservice.infrastructure.elasticsearch.ProductElasticsearchRepository;
import com.vnshop.searchservice.infrastructure.idempotency.ProcessedEvent;
import com.vnshop.searchservice.infrastructure.idempotency.ProcessedEventRepository;
import com.vnshop.searchservice.infrastructure.persistence.ProductReadModelJpaEntity;
import com.vnshop.searchservice.infrastructure.persistence.ProductReadModelRepository;
import com.vnshop.searchservice.domain.ProductReadModel;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductProjectionRepairJob {
    private final ProductProjectionRepairRepository repairRepository;
    private final ProductReadModelRepository readModelRepository;
    private final ProductElasticsearchRepository elasticsearchRepository;
    private final ProcessedEventRepository processedEventRepository;
    private final int batchSize;

    public ProductProjectionRepairJob(ProductProjectionRepairRepository repairRepository,
            ProductReadModelRepository readModelRepository, ProductElasticsearchRepository elasticsearchRepository,
            ProcessedEventRepository processedEventRepository,
            @Value("${search.projection-repair.batch-size:50}") int batchSize) {
        this.repairRepository = repairRepository;
        this.readModelRepository = readModelRepository;
        this.elasticsearchRepository = elasticsearchRepository;
        this.processedEventRepository = processedEventRepository;
        this.batchSize = batchSize;
    }

    @Scheduled(fixedDelayString = "${search.projection-repair.poll-interval-ms:5000}")
    @Transactional
    public void repairPending() {
        for (ProductProjectionRepair repair : repairRepository.findAllByOrderByCreatedAtAsc(PageRequest.of(0, batchSize))) {
            if ("DELETED".equals(repair.getEventType())) {
                elasticsearchRepository.deleteById(repair.getProductId());
            } else {
                ProductReadModelJpaEntity model = readModelRepository.findById(repair.getProductId()).orElse(null);
                if (model == null) {
                    continue;
                }
                elasticsearchRepository.save(ProductDocument.fromEvent(repair.getProductId(), payload(model.toDomain())));
            }
            processedEventRepository.save(new ProcessedEvent(repair.getEventId(), repair.getEventType(), Instant.now()));
            repairRepository.delete(repair);
        }
    }

    private static Map<String, Object> payload(ProductReadModel model) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("name", model.name());
        payload.put("description", model.description());
        payload.put("categoryId", model.categoryId());
        payload.put("brand", model.brand());
        payload.put("status", model.status());
        payload.put("minPrice", model.minPrice());
        payload.put("maxPrice", model.maxPrice());
        payload.put("variantCount", model.variantCount());
        payload.put("imageUrl", model.imageUrl());
        payload.put("stock", model.stock());
        payload.put("sameDayDelivery", model.sameDayDelivery());
        payload.put("verified", model.verified());
        payload.put("isOfficial", model.isOfficial());
        return payload;
    }
}
