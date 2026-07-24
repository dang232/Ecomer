package com.vnshop.sellerfinanceservice.application;

import com.vnshop.sellerfinanceservice.domain.FinancialAdjustment;
import com.vnshop.sellerfinanceservice.domain.LedgerAccountCode;
import com.vnshop.sellerfinanceservice.domain.LedgerDirection;
import com.vnshop.sellerfinanceservice.domain.LedgerJournal;
import com.vnshop.sellerfinanceservice.domain.LedgerJournalType;
import com.vnshop.sellerfinanceservice.domain.LedgerPosting;
import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.port.out.FinanceEventInboxPort;
import com.vnshop.sellerfinanceservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public class ApplyFinancialAdjustmentUseCase {
    private final LedgerRepositoryPort ledgerRepository;
    private final FinanceEventInboxPort inboxRepository;
    private final SellerWalletRepositoryPort walletRepository;
    private final FailureInjector failureInjector;

    public ApplyFinancialAdjustmentUseCase(
            LedgerRepositoryPort ledgerRepository,
            FinanceEventInboxPort inboxRepository,
            SellerWalletRepositoryPort walletRepository) {
        this(ledgerRepository, inboxRepository, walletRepository, ignored -> { });
    }

    public ApplyFinancialAdjustmentUseCase(
            LedgerRepositoryPort ledgerRepository,
            FinanceEventInboxPort inboxRepository,
            SellerWalletRepositoryPort walletRepository,
            FailureInjector failureInjector) {
        this.ledgerRepository = Objects.requireNonNull(ledgerRepository, "ledgerRepository is required");
        this.inboxRepository = Objects.requireNonNull(inboxRepository, "inboxRepository is required");
        this.walletRepository = Objects.requireNonNull(walletRepository, "walletRepository is required");
        this.failureInjector = Objects.requireNonNull(failureInjector, "failureInjector is required");
    }

    @Transactional
    public ApplyResult apply(FinancialAdjustment adjustment) {
        Objects.requireNonNull(adjustment, "adjustment is required");

        Optional<UUID> replayJournalId = inboxRepository.findJournalIdByEventId(adjustment.eventId());
        if (replayJournalId.isPresent()) {
            return new ApplyResult(adjustment.eventId(), replayJournalId.get());
        }

        Optional<LedgerJournal> existingOperation = ledgerRepository.findBySourceOperation(
                adjustment.sourceType(), adjustment.adjustmentId(), adjustment.operationType());
        if (existingOperation.isPresent()) {
            UUID journalId = existingOperation.get().journalId();
            inboxRepository.record(adjustment.eventId(), journalId);
            return new ApplyResult(adjustment.eventId(), journalId);
        }

        LedgerJournal journal = createJournal(adjustment);
        ledgerRepository.save(journal);
        failureInjector.after(FailurePoint.AFTER_JOURNAL);

        SellerWallet wallet = walletRepository.findBySellerIdForUpdate(adjustment.sellerId())
                .orElseGet(() -> new SellerWallet(adjustment.sellerId()));
        if (adjustment.adjustmentType() == FinancialAdjustment.AdjustmentType.CREDIT) {
            wallet.creditSettlement(adjustment.components().sellerPayableAmount(), adjustment.components().platformCommissionAmount());
        } else {
            wallet.releaseSettlement(adjustment.components().sellerPayableAmount());
        }
        walletRepository.save(wallet);
        failureInjector.after(FailurePoint.AFTER_PROJECTION);
        inboxRepository.record(adjustment.eventId(), journal.journalId());
        return new ApplyResult(adjustment.eventId(), journal.journalId());
    }

    private LedgerJournal createJournal(FinancialAdjustment adjustment) {
        BigDecimal sellerPayable = adjustment.components().sellerPayableAmount();
        BigDecimal commission = adjustment.components().platformCommissionAmount();
        List<LedgerPosting> postings;
        LedgerJournalType journalType;
        UUID reversalId = adjustment.reversalId();
        if (adjustment.adjustmentType() == FinancialAdjustment.AdjustmentType.CREDIT) {
            java.util.ArrayList<LedgerPosting> creditPostings = new java.util.ArrayList<>();
            creditPostings.add(posting(LedgerAccountCode.MARKETPLACE_CLEARING, LedgerDirection.DEBIT,
                    sellerPayable.add(commission), adjustment.currency()));
            creditPostings.add(posting(LedgerAccountCode.SELLER_SETTLEMENT_PENDING, LedgerDirection.CREDIT,
                    sellerPayable, adjustment.currency()));
            if (commission.compareTo(BigDecimal.ZERO) > 0) {
                creditPostings.add(posting(LedgerAccountCode.PLATFORM_COMMISSION_REVENUE, LedgerDirection.CREDIT,
                        commission, adjustment.currency()));
            }
            postings = List.copyOf(creditPostings);
            journalType = LedgerJournalType.SELLER_CREDIT;
        } else {
            postings = List.of(
                    posting(LedgerAccountCode.SELLER_SETTLEMENT_PENDING, LedgerDirection.DEBIT, sellerPayable, adjustment.currency()),
                    posting(LedgerAccountCode.SELLER_AVAILABLE, LedgerDirection.CREDIT, sellerPayable, adjustment.currency()));
            journalType = LedgerJournalType.SETTLEMENT_RELEASE;
        }
        return new LedgerJournal(
                UUID.randomUUID(), adjustment.sellerId(), adjustment.sourceType(), adjustment.adjustmentId(),
                adjustment.operationType(), journalType, adjustment.occurredAt(), reversalId, postings);
    }

    private static LedgerPosting posting(LedgerAccountCode accountCode, LedgerDirection direction, BigDecimal amount, String currency) {
        return new LedgerPosting(accountCode, direction, amount, currency);
    }

    public record ApplyResult(UUID eventId, UUID journalId) {
    }

    @FunctionalInterface
    public interface FailureInjector {
        void after(FailurePoint point);
    }

    public enum FailurePoint {
        AFTER_JOURNAL,
        AFTER_PROJECTION
    }
}
