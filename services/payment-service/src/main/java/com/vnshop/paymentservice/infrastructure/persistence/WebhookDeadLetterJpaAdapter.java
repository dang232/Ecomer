package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.domain.WebhookDeadLetterRecord;
import com.vnshop.paymentservice.domain.port.out.WebhookDeadLetterPort;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Repository
public class WebhookDeadLetterJpaAdapter implements WebhookDeadLetterPort {

    private final WebhookDeadLetterSpringDataRepository repository;

    public WebhookDeadLetterJpaAdapter(WebhookDeadLetterSpringDataRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository is required");
    }

    @Override
    public WebhookDeadLetterRecord save(WebhookDeadLetterRecord record) {
        WebhookDeadLetterJpaEntity entity = new WebhookDeadLetterJpaEntity(
                record.id(),
                record.webhookId(),
                record.provider(),
                record.eventType(),
                record.payload(),
                record.failureReason(),
                record.attempts(),
                record.createdAt(),
                record.retriedAt(),
                record.retryCount()
        );
        return toRecord(repository.save(entity));
    }

    @Override
    public Page<WebhookDeadLetterRecord> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(this::toRecord);
    }

    @Override
    public Optional<WebhookDeadLetterRecord> findById(UUID id) {
        return repository.findById(id).map(this::toRecord);
    }

    @Override
    public WebhookDeadLetterRecord recordRetry(UUID id) {
        WebhookDeadLetterJpaEntity entity = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("WebhookDeadLetterRecord not found: " + id));
        entity.setRetriedAt(Instant.now());
        entity.setRetryCount(entity.getRetryCount() + 1);
        return toRecord(repository.save(entity));
    }

    private WebhookDeadLetterRecord toRecord(WebhookDeadLetterJpaEntity e) {
        return new WebhookDeadLetterRecord(
                e.getId(),
                e.getWebhookId(),
                e.getProvider(),
                e.getEventType(),
                e.getPayload(),
                e.getFailureReason(),
                e.getAttempts(),
                e.getCreatedAt(),
                e.getRetriedAt(),
                e.getRetryCount()
        );
    }
}
