package com.vnshop.productservice.infrastructure.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ProductEventPublisherPort;
import com.vnshop.productservice.infrastructure.persistence.ProductEventOutboxJpaEntity;
import com.vnshop.productservice.infrastructure.persistence.ProductEventOutboxSpringDataRepository;
import java.time.Instant;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@ConditionalOnProperty(name = "spring.data.jpa.repositories.enabled", havingValue = "true", matchIfMissing = true)
class ProductEventOutboxRelay {
    private static final Logger LOGGER = LoggerFactory.getLogger(ProductEventOutboxRelay.class);
    private final ProductEventOutboxSpringDataRepository repository;
    private final ProductEventPublisherPort publisher;
    private final ObjectMapper objectMapper;
    private final int batchSize;
    private final int maxAttempts;
    private final long sendTimeoutMs;

    ProductEventOutboxRelay(ProductEventOutboxSpringDataRepository repository, ProductEventPublisherPort publisher,
            ObjectMapper objectMapper, @Value("${product.outbox.batch-size:50}") int batchSize,
            @Value("${product.outbox.max-attempts:8}") int maxAttempts,
            @Value("${product.outbox.send-timeout-ms:5000}") long sendTimeoutMs) {
        this.repository = repository;
        this.publisher = publisher;
        this.objectMapper = objectMapper;
        this.batchSize = batchSize;
        this.maxAttempts = maxAttempts;
        this.sendTimeoutMs = sendTimeoutMs;
    }

    @Scheduled(fixedDelayString = "${product.outbox.poll-interval-ms:1000}")
    @Transactional
    public void publishPending() {
        for (ProductEventOutboxJpaEntity row : repository.findRetryable(Instant.now(), PageRequest.of(0, batchSize))) {
            try {
                ProductEvent event = objectMapper.readValue(row.getPayload(), ProductEvent.class);
                publisher.publish(event).get(sendTimeoutMs, TimeUnit.MILLISECONDS);
                row.markPublished();
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                row.recordFailure(maxAttempts, exception);
            } catch (JsonProcessingException | ExecutionException | TimeoutException | RuntimeException exception) {
                row.recordFailure(maxAttempts, exception);
            }
            repository.save(row);
        }
    }
}
