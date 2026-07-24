package com.vnshop.sellerfinanceservice.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public final class LedgerJournal {
    private final UUID journalId;
    private final String sellerId;
    private final String sourceType;
    private final UUID sourceId;
    private final String operationType;
    private final LedgerJournalType journalType;
    private final Instant occurredAt;
    private final UUID reversalOfJournalId;
    private final List<LedgerPosting> postings;

    public LedgerJournal(
            UUID journalId,
            String sellerId,
            String sourceType,
            UUID sourceId,
            String operationType,
            LedgerJournalType journalType,
            Instant occurredAt,
            UUID reversalOfJournalId,
            List<LedgerPosting> postings) {
        this.journalId = Objects.requireNonNull(journalId, "journalId is required");
        requireNonBlank(sellerId, "sellerId");
        requireNonBlank(sourceType, "sourceType");
        this.sellerId = sellerId;
        this.sourceType = sourceType;
        this.sourceId = Objects.requireNonNull(sourceId, "sourceId is required");
        requireNonBlank(operationType, "operationType");
        this.operationType = operationType;
        this.journalType = Objects.requireNonNull(journalType, "journalType is required");
        this.occurredAt = Objects.requireNonNull(occurredAt, "occurredAt is required");
        if (journalId.equals(reversalOfJournalId)) {
            throw new IllegalArgumentException("journal cannot reverse itself");
        }
        this.reversalOfJournalId = reversalOfJournalId;
        this.postings = List.copyOf(Objects.requireNonNull(postings, "postings are required"));
        if (this.postings.size() < 2) {
            throw new IllegalArgumentException("journal must contain at least two postings");
        }
        if (!isBalanced()) {
            throw new IllegalArgumentException("journal postings must balance for every currency");
        }
    }

    public UUID journalId() { return journalId; }
    public String sellerId() { return sellerId; }
    public String sourceType() { return sourceType; }
    public UUID sourceId() { return sourceId; }
    public String operationType() { return operationType; }
    public LedgerJournalType journalType() { return journalType; }
    public Instant occurredAt() { return occurredAt; }
    public java.util.Optional<UUID> reversalOfJournalId() { return java.util.Optional.ofNullable(reversalOfJournalId); }
    public List<LedgerPosting> postings() { return postings; }

    public boolean isReversal() {
        return reversalOfJournalId != null;
    }

    public boolean hasSourceOperation(String expectedSourceType, UUID expectedSourceId, String expectedOperationType) {
        return sourceType.equals(expectedSourceType)
                && sourceId.equals(expectedSourceId)
                && operationType.equals(expectedOperationType);
    }

    public boolean isBalanced() {
        Map<String, EnumMap<LedgerDirection, BigDecimal>> totals = new HashMap<>();
        for (LedgerPosting posting : postings) {
            EnumMap<LedgerDirection, BigDecimal> directions = totals.computeIfAbsent(
                    posting.currency(), ignored -> new EnumMap<>(LedgerDirection.class));
            directions.merge(posting.direction(), posting.amount(), BigDecimal::add);
        }
        return totals.values().stream().allMatch(directions ->
                directions.getOrDefault(LedgerDirection.DEBIT, BigDecimal.ZERO)
                        .compareTo(directions.getOrDefault(LedgerDirection.CREDIT, BigDecimal.ZERO)) == 0);
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
