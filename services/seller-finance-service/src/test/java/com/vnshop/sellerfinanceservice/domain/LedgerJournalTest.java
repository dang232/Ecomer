package com.vnshop.sellerfinanceservice.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class LedgerJournalTest {

    private static final String CURRENCY = "VND";

    @Test
    void acceptsBalancedPostingsPerCurrency() {
        LedgerJournal journal = journal(
                new LedgerPosting(LedgerAccountCode.MARKETPLACE_CLEARING, LedgerDirection.DEBIT, bd("100.00"), CURRENCY),
                new LedgerPosting(LedgerAccountCode.SELLER_SETTLEMENT_PENDING, LedgerDirection.CREDIT, bd("100.00"), CURRENCY));

        assertThat(journal.isBalanced()).isTrue();
        assertThat(journal.postings()).hasSize(2);
        assertThat(journal.postings()).isUnmodifiable();
    }

    @Test
    void rejectsNonPositivePostingAmounts() {
        assertThatIllegalArgumentException().isThrownBy(() ->
                new LedgerPosting(LedgerAccountCode.SELLER_AVAILABLE, LedgerDirection.CREDIT, BigDecimal.ZERO, CURRENCY));
    }

    @Test
    void rejectsAnUnbalancedJournal() {
        assertThatIllegalArgumentException().isThrownBy(() -> journal(
                new LedgerPosting(LedgerAccountCode.MARKETPLACE_CLEARING, LedgerDirection.DEBIT, bd("101.00"), CURRENCY),
                new LedgerPosting(LedgerAccountCode.SELLER_SETTLEMENT_PENDING, LedgerDirection.CREDIT, bd("100.00"), CURRENCY)));
    }

    @Test
    void keepsReversalLinkedToTheOriginalJournal() {
        UUID originalId = UUID.randomUUID();
        LedgerJournal reversal = new LedgerJournal(
                UUID.randomUUID(), "seller-1", "SELLER_FINANCE_ADJUSTMENT", UUID.randomUUID(), "REFUND_REVERSAL",
                LedgerJournalType.REFUND_REVERSAL, Instant.now(), originalId, List.of(
                        new LedgerPosting(LedgerAccountCode.SELLER_AVAILABLE, LedgerDirection.DEBIT, bd("25.00"), CURRENCY),
                        new LedgerPosting(LedgerAccountCode.SELLER_DEBT, LedgerDirection.CREDIT, bd("25.00"), CURRENCY)));

        assertThat(reversal.reversalOfJournalId()).contains(originalId);
        assertThat(reversal.isReversal()).isTrue();
    }

    @Test
    void rejectsAJournalLinkedToItself() {
        UUID journalId = UUID.randomUUID();
        assertThatIllegalArgumentException().isThrownBy(() -> new LedgerJournal(
                journalId, "seller-1", "SELLER_FINANCE_ADJUSTMENT", UUID.randomUUID(), "REFUND_REVERSAL",
                LedgerJournalType.REFUND_REVERSAL, Instant.now(), journalId, List.of(
                        new LedgerPosting(LedgerAccountCode.SELLER_AVAILABLE, LedgerDirection.DEBIT, bd("25.00"), CURRENCY),
                        new LedgerPosting(LedgerAccountCode.SELLER_DEBT, LedgerDirection.CREDIT, bd("25.00"), CURRENCY))));
    }

    private static LedgerJournal journal(LedgerPosting... postings) {
        return new LedgerJournal(
                UUID.randomUUID(), "seller-1", "SELLER_FINANCE_ADJUSTMENT", UUID.randomUUID(), "CREDIT",
                LedgerJournalType.SELLER_CREDIT, Instant.now(), null, List.of(postings));
    }

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }
}
