package com.vnshop.productservice.infrastructure.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.productservice.domain.ProductEvent;
import com.vnshop.productservice.domain.port.out.ProductEventOutboxPort;
import com.vnshop.productservice.infrastructure.persistence.ProductEventOutboxJpaEntity;
import com.vnshop.productservice.infrastructure.persistence.ProductEventOutboxSpringDataRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

@Repository
@ConditionalOnProperty(name = "spring.data.jpa.repositories.enabled", havingValue = "true", matchIfMissing = true)
class ProductEventOutboxAdapter implements ProductEventOutboxPort {
    private final ProductEventOutboxSpringDataRepository repository;
    private final ObjectMapper objectMapper;

    ProductEventOutboxAdapter(ProductEventOutboxSpringDataRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void enqueue(ProductEvent event) {
        try {
            repository.save(new ProductEventOutboxJpaEntity(event.productId(), objectMapper.writeValueAsString(event)));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize product lifecycle event", exception);
        }
    }
}
