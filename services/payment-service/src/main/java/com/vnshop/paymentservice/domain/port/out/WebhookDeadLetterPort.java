package com.vnshop.paymentservice.domain.port.out;

import com.vnshop.paymentservice.domain.WebhookDeadLetterRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.UUID;

/**
 * Persistence port for the webhook dead-letter store.
 */
public interface WebhookDeadLetterPort {

    WebhookDeadLetterRecord save(WebhookDeadLetterRecord record);

    Page<WebhookDeadLetterRecord> findAll(Pageable pageable);

    Optional<WebhookDeadLetterRecord> findById(UUID id);

    WebhookDeadLetterRecord recordRetry(UUID id);
}
