package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.LedgerJournal;
import com.vnshop.sellerfinanceservice.domain.LedgerJournalType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(schema = "seller_finance_svc", name = "ledger_journals")
public class LedgerJournalJpaEntity {
    @Id
    @Column(name = "journal_id", nullable = false)
    private UUID journalId;

    @Column(name = "seller_id", nullable = false, length = 255)
    private String sellerId;

    @Column(name = "source_type", nullable = false, length = 128)
    private String sourceType;

    @Column(name = "source_id", nullable = false)
    private UUID sourceId;

    @Column(name = "operation_type", nullable = false, length = 128)
    private String operationType;

    @Enumerated(EnumType.STRING)
    @Column(name = "journal_type", nullable = false, length = 64)
    private LedgerJournalType journalType;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "reversal_of_journal_id")
    private UUID reversalOfJournalId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "journal", cascade = CascadeType.ALL, orphanRemoval = false, fetch = FetchType.EAGER)
    private List<LedgerPostingJpaEntity> postings = new ArrayList<>();

    protected LedgerJournalJpaEntity() {
    }

    static LedgerJournalJpaEntity fromDomain(LedgerJournal journal) {
        LedgerJournalJpaEntity entity = new LedgerJournalJpaEntity();
        entity.journalId = journal.journalId();
        entity.sellerId = journal.sellerId();
        entity.sourceType = journal.sourceType();
        entity.sourceId = journal.sourceId();
        entity.operationType = journal.operationType();
        entity.journalType = journal.journalType();
        entity.occurredAt = journal.occurredAt();
        entity.reversalOfJournalId = journal.reversalOfJournalId().orElse(null);
        entity.createdAt = Instant.now();
        for (var posting : journal.postings()) {
            LedgerPostingJpaEntity postingEntity = LedgerPostingJpaEntity.fromDomain(posting);
            postingEntity.setJournal(entity);
            entity.postings.add(postingEntity);
        }
        return entity;
    }

    LedgerJournal toDomain() {
        return new LedgerJournal(
                journalId, sellerId, sourceType, sourceId, operationType, journalType, occurredAt,
                reversalOfJournalId, postings.stream().map(LedgerPostingJpaEntity::toDomain).toList());
    }
}
