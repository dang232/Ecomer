package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "seller_finance_svc", name = "finance_event_inbox")
public class FinanceEventInboxJpaEntity {
    @Id
    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "journal_id", nullable = false)
    private UUID journalId;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;

    protected FinanceEventInboxJpaEntity() {
    }

    FinanceEventInboxJpaEntity(UUID eventId, UUID journalId) {
        this.eventId = eventId;
        this.journalId = journalId;
        this.processedAt = Instant.now();
    }

    UUID journalId() {
        return journalId;
    }
}
