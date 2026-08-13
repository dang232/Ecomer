package com.vnshop.paymentservice.infrastructure.persistence;

import java.time.Instant;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProcessedWebhookSpringDataRepository
        extends JpaRepository<ProcessedWebhookJpaEntity, ProcessedWebhookJpaEntity.ProcessedWebhookId> {

    boolean existsByWebhookIdAndProvider(String webhookId, String provider);

    @Modifying
    @Query(value = """
            INSERT INTO payment_svc.processed_webhooks
                (webhook_id, provider, event_type, processed_at)
            VALUES (:webhookId, :provider, :eventType, :processedAt)
            ON CONFLICT (webhook_id, provider) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(
            @Param("webhookId") String webhookId,
            @Param("provider") String provider,
            @Param("eventType") String eventType,
            @Param("processedAt") Instant processedAt);
}
