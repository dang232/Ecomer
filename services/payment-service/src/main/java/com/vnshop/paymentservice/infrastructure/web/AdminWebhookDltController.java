package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.application.webhook.WebhookDeadLetterRecord;
import com.vnshop.paymentservice.application.webhook.WebhookDeadLetterService;
import com.vnshop.paymentservice.application.webhook.WebhookDltEvent;
import com.vnshop.paymentservice.domain.port.out.WebhookDeadLetterPort;
import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Admin-only API for inspecting and retrying dead-lettered webhooks.
 * Requires {@code ROLE_ADMIN} authority on all endpoints.
 */
@RestController
@Hidden
@RequestMapping("/api/v1/admin/webhooks")
@PreAuthorize("hasRole('ADMIN')")
public class AdminWebhookDltController {

    private static final String RETRY_TOPIC = "payment.webhooks.retry";

    private final WebhookDeadLetterPort deadLetterPort;
    private final ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider;

    public AdminWebhookDltController(
            WebhookDeadLetterPort deadLetterPort,
            ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider) {
        this.deadLetterPort = Objects.requireNonNull(deadLetterPort, "deadLetterPort is required");
        this.kafkaTemplateProvider = Objects.requireNonNull(kafkaTemplateProvider, "kafkaTemplateProvider is required");
    }

    /**
     * List all dead-lettered webhooks, newest first.
     */
    @GetMapping("/failed")
    public ResponseEntity<ApiResponse<Page<FailedWebhookResponse>>> listFailed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<FailedWebhookResponse> results = deadLetterPort.findAll(pageable)
                .map(FailedWebhookResponse::from);
        return ResponseEntity.ok(ApiResponse.ok(results));
    }

    /**
     * Re-enqueue a dead-lettered webhook for processing by publishing it back
     * to {@code payment.webhooks.retry}.
     */
    @PostMapping("/failed/{id}/retry")
    public ResponseEntity<ApiResponse<FailedWebhookResponse>> retry(@PathVariable UUID id) {
        WebhookDeadLetterRecord record = deadLetterPort.findById(id)
                .orElse(null);
        if (record == null) {
            return ResponseEntity.status(404)
                    .body(ApiResponse.error("Dead-letter record not found: " + id, "NOT_FOUND"));
        }

        KafkaTemplate<String, Object> kafkaTemplate = kafkaTemplateProvider.getIfAvailable();
        if (kafkaTemplate == null) {
            return ResponseEntity.status(503)
                    .body(ApiResponse.error("Kafka unavailable — retry not possible", "SERVICE_UNAVAILABLE"));
        }

        WebhookDltEvent retryEvent = new WebhookDltEvent(
                record.webhookId(),
                record.provider(),
                record.eventType(),
                record.payload(),
                record.failureReason(),
                record.attempts(),
                Instant.now()
        );
        kafkaTemplate.send(RETRY_TOPIC, record.webhookId(), retryEvent);

        WebhookDeadLetterRecord updated = deadLetterPort.recordRetry(id);
        return ResponseEntity.ok(ApiResponse.ok(FailedWebhookResponse.from(updated)));
    }

    public record FailedWebhookResponse(
            UUID id,
            String webhookId,
            String provider,
            String eventType,
            String failureReason,
            int attempts,
            Instant createdAt,
            Instant retriedAt,
            int retryCount
    ) {
        static FailedWebhookResponse from(WebhookDeadLetterRecord r) {
            return new FailedWebhookResponse(
                    r.id(), r.webhookId(), r.provider(), r.eventType(),
                    r.failureReason(), r.attempts(), r.createdAt(),
                    r.retriedAt(), r.retryCount());
        }
    }
}
