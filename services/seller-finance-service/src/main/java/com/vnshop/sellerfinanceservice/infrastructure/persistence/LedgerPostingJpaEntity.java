package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.LedgerAccountCode;
import com.vnshop.sellerfinanceservice.domain.LedgerDirection;
import com.vnshop.sellerfinanceservice.domain.LedgerPosting;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(schema = "seller_finance_svc", name = "ledger_postings")
public class LedgerPostingJpaEntity {
    @Id
    @Column(name = "posting_id", nullable = false)
    private UUID postingId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "journal_id", nullable = false)
    private LedgerJournalJpaEntity journal;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_code", nullable = false, length = 64)
    private LedgerAccountCode accountCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "direction", nullable = false, length = 16)
    private LedgerDirection direction;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    protected LedgerPostingJpaEntity() {
    }

    static LedgerPostingJpaEntity fromDomain(LedgerPosting posting) {
        LedgerPostingJpaEntity entity = new LedgerPostingJpaEntity();
        entity.postingId = UUID.randomUUID();
        entity.accountCode = posting.accountCode();
        entity.direction = posting.direction();
        entity.amount = posting.amount();
        entity.currency = posting.currency();
        return entity;
    }

    LedgerPosting toDomain() {
        return new LedgerPosting(accountCode, direction, amount, currency);
    }

    void setJournal(LedgerJournalJpaEntity journal) {
        this.journal = journal;
    }
}
