package com.vnshop.sellerfinanceservice.application;

import com.vnshop.sellerfinanceservice.domain.FinancialAdjustment;
import com.vnshop.sellerfinanceservice.domain.LedgerAccountCode;
import com.vnshop.sellerfinanceservice.domain.LedgerDirection;
import com.vnshop.sellerfinanceservice.domain.LedgerJournal;
import com.vnshop.sellerfinanceservice.domain.LedgerJournalType;
import com.vnshop.sellerfinanceservice.domain.LedgerPosting;
import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.port.out.ChargebackHoldAllocationRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.FinanceEventInboxPort;
import com.vnshop.sellerfinanceservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public class ApplyFinancialAdjustmentUseCase {
    private final LedgerRepositoryPort ledgerRepository;
    private final FinanceEventInboxPort inboxRepository;
    private final SellerWalletRepositoryPort walletRepository;
    private final ChargebackHoldAllocationRepositoryPort holdRepository;
    private final FailureInjector failureInjector;

    public ApplyFinancialAdjustmentUseCase(
            LedgerRepositoryPort ledgerRepository,
            FinanceEventInboxPort inboxRepository,
            SellerWalletRepositoryPort walletRepository,
            ChargebackHoldAllocationRepositoryPort holdRepository) {
        this(ledgerRepository, inboxRepository, walletRepository, holdRepository, ignored -> { });
    }

    /** Legacy 4-arg constructor used by integration tests that inject a failure injector directly. */
    public ApplyFinancialAdjustmentUseCase(
            LedgerRepositoryPort ledgerRepository,
            FinanceEventInboxPort inboxRepository,
            SellerWalletRepositoryPort walletRepository,
            FailureInjector failureInjector) {
        this(ledgerRepository, inboxRepository, walletRepository,
                new NoopChargebackHoldAllocation(), failureInjector);
    }

    public ApplyFinancialAdjustmentUseCase(
            LedgerRepositoryPort ledgerRepository,
            FinanceEventInboxPort inboxRepository,
            SellerWalletRepositoryPort walletRepository,
            ChargebackHoldAllocationRepositoryPort holdRepository,
            FailureInjector failureInjector) {
        this.ledgerRepository = Objects.requireNonNull(ledgerRepository, "ledgerRepository is required");
        this.inboxRepository = Objects.requireNonNull(inboxRepository, "inboxRepository is required");
        this.walletRepository = Objects.requireNonNull(walletRepository, "walletRepository is required");
        this.holdRepository = Objects.requireNonNull(holdRepository, "holdRepository is required");
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
                adjustment.sourceType(), adjustment.sourceOperationId(), adjustment.operationType());
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
        applyProjection(adjustment, wallet);
        failureInjector.after(FailurePoint.AFTER_PROJECTION);
        walletRepository.save(wallet);
        inboxRepository.record(adjustment.eventId(), journal.journalId());
        return new ApplyResult(adjustment.eventId(), journal.journalId());
    }

    private void applyProjection(FinancialAdjustment adjustment, SellerWallet wallet) {
        BigDecimal amount = adjustment.components().sellerPayableAmount();
        switch (adjustment.adjustmentType()) {
            case CREDIT -> wallet.creditSettlement(amount, adjustment.components().platformCommissionAmount());
            case RELEASE -> wallet.releaseSettlement(amount);
            case REFUND_REVERSAL -> wallet.applyRefund(amount);
            case CHARGEBACK_FINALIZE -> {
                UUID finalizeHoldId = Objects.requireNonNull(adjustment.reversalId(),
                        "reversalId is the holdId for CHARGEBACK_FINALIZE");
                SellerWallet.HoldAllocation finalized = wallet.finalizeChargeback(finalizeHoldId);
                holdRepository.record(finalized.holdId(), wallet.sellerId(), finalized.amount(),
                        finalized.sourceBucket(), finalized.status());
            }
            case CHARGEBACK_HOLD -> {
                UUID holdId = Objects.requireNonNull(adjustment.reversalId(), "reversalId is the holdId for CHARGEBACK_HOLD");
                SellerWallet.WalletBucket source = adjustment.components().chargebackHoldSourceBucket();
                wallet.holdChargeback(holdId, amount, source);
                holdRepository.record(holdId, wallet.sellerId(), amount, source, SellerWallet.HoldStatus.HELD);
            }
            case CHARGEBACK_RELEASE -> {
                UUID holdId = Objects.requireNonNull(adjustment.reversalId(), "reversalId is the holdId for CHARGEBACK_RELEASE");
                SellerWallet.HoldAllocation allocation = wallet.releaseChargeback(holdId);
                holdRepository.record(allocation.holdId(), wallet.sellerId(), allocation.amount(),
                        allocation.sourceBucket(), allocation.status());
            }
        }
    }

    private LedgerJournal createJournal(FinancialAdjustment adjustment) {
        BigDecimal sellerPayable = adjustment.components().sellerPayableAmount();
        BigDecimal commission = adjustment.components().platformCommissionAmount();
        String currency = adjustment.currency();
        List<LedgerPosting> postings;
        LedgerJournalType journalType;
        UUID reversalId = adjustment.reversalId();
        if (adjustment.adjustmentType() == FinancialAdjustment.AdjustmentType.CREDIT) {
            ArrayList<LedgerPosting> creditPostings = new ArrayList<>();
            creditPostings.add(posting(LedgerAccountCode.MARKETPLACE_CLEARING, LedgerDirection.DEBIT,
                    sellerPayable.add(commission), currency));
            creditPostings.add(posting(LedgerAccountCode.SELLER_SETTLEMENT_PENDING, LedgerDirection.CREDIT,
                    sellerPayable, currency));
            if (commission.compareTo(BigDecimal.ZERO) > 0) {
                creditPostings.add(posting(LedgerAccountCode.PLATFORM_COMMISSION_REVENUE, LedgerDirection.CREDIT,
                        commission, currency));
            }
            postings = List.copyOf(creditPostings);
            journalType = LedgerJournalType.SELLER_CREDIT;
        } else if (adjustment.adjustmentType() == FinancialAdjustment.AdjustmentType.RELEASE) {
            postings = List.of(
                    posting(LedgerAccountCode.SELLER_SETTLEMENT_PENDING, LedgerDirection.DEBIT, sellerPayable, currency),
                    posting(LedgerAccountCode.SELLER_AVAILABLE, LedgerDirection.CREDIT, sellerPayable, currency));
            journalType = LedgerJournalType.SETTLEMENT_RELEASE;
        } else if (adjustment.adjustmentType() == FinancialAdjustment.AdjustmentType.REFUND_REVERSAL) {
            ArrayList<LedgerPosting> reversalPostings = new ArrayList<>();
            if (sellerPayable.signum() > 0) {
                reversalPostings.add(posting(LedgerAccountCode.SELLER_SETTLEMENT_PENDING, LedgerDirection.DEBIT,
                        sellerPayable, currency));
                reversalPostings.add(posting(LedgerAccountCode.MARKETPLACE_CLEARING, LedgerDirection.CREDIT,
                        sellerPayable, currency));
            }
            if (commission.signum() > 0) {
                reversalPostings.add(posting(LedgerAccountCode.PLATFORM_COMMISSION_REVENUE, LedgerDirection.DEBIT,
                        commission, currency));
                reversalPostings.add(posting(LedgerAccountCode.MARKETPLACE_CLEARING, LedgerDirection.CREDIT,
                        commission, currency));
            }
            if (reversalPostings.isEmpty()) {
                throw new IllegalArgumentException("reversal must include a positive seller payable or commission amount");
            }
            postings = List.copyOf(reversalPostings);
            journalType = LedgerJournalType.REFUND_REVERSAL;
        } else if (adjustment.adjustmentType() == FinancialAdjustment.AdjustmentType.CHARGEBACK_FINALIZE) {
            // CHARGEBACK_FINALIZE consumes the reserve allocation recorded at hold time.
            // The seller payable funds are already debited from the source bucket and credited to reserve,
            // so finalize only debits reserve and credits marketplace clearing — no second debit against
            // settlement-pending/available.
            postings = List.of(
                    posting(LedgerAccountCode.SELLER_RESERVE, LedgerDirection.DEBIT, sellerPayable, currency),
                    posting(LedgerAccountCode.MARKETPLACE_CLEARING, LedgerDirection.CREDIT, sellerPayable, currency));
            journalType = LedgerJournalType.CHARGEBACK_FINALIZE;
        } else if (adjustment.adjustmentType() == FinancialAdjustment.AdjustmentType.CHARGEBACK_HOLD) {
            SellerWallet.WalletBucket source = adjustment.components().chargebackHoldSourceBucket();
            LedgerAccountCode sourceAccount = switch (source) {
                case SETTLEMENT_PENDING -> LedgerAccountCode.SELLER_SETTLEMENT_PENDING;
                case AVAILABLE -> LedgerAccountCode.SELLER_AVAILABLE;
                case RESERVE -> LedgerAccountCode.SELLER_RESERVE;
            };
            postings = List.of(
                    posting(sourceAccount, LedgerDirection.DEBIT, sellerPayable, currency),
                    posting(LedgerAccountCode.SELLER_RESERVE, LedgerDirection.CREDIT, sellerPayable, currency));
            journalType = LedgerJournalType.CHARGEBACK_HOLD;
        } else {
            // CHARGEBACK_RELEASE: debit reserve, credit the originally-held source bucket.
            UUID holdId = Objects.requireNonNull(adjustment.reversalId(), "reversalId is the holdId for CHARGEBACK_RELEASE");
            ChargebackHoldAllocationRepositoryPort.HoldRecord record = holdRepository.find(holdId)
                    .orElseThrow(() -> new IllegalStateException("no chargeback hold allocation for " + holdId));
            LedgerAccountCode sourceAccount = switch (record.sourceBucket()) {
                case SETTLEMENT_PENDING -> LedgerAccountCode.SELLER_SETTLEMENT_PENDING;
                case AVAILABLE -> LedgerAccountCode.SELLER_AVAILABLE;
                case RESERVE -> LedgerAccountCode.SELLER_RESERVE;
            };
            postings = List.of(
                    posting(LedgerAccountCode.SELLER_RESERVE, LedgerDirection.DEBIT, sellerPayable, currency),
                    posting(sourceAccount, LedgerDirection.CREDIT, sellerPayable, currency));
            journalType = LedgerJournalType.CHARGEBACK_RELEASE;
        }
        return new LedgerJournal(
                UUID.randomUUID(), adjustment.sellerId(), adjustment.sourceType(), adjustment.sourceOperationId(),
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

    /** No-op port used by tests that exercise the legacy 4-arg constructor
     *  without supplying a hold repository. Real production wiring receives
     *  the in-memory holder from {@code UseCaseConfig}. */
    private static final class NoopChargebackHoldAllocation implements ChargebackHoldAllocationRepositoryPort {
        @Override
        public void record(UUID holdId, String sellerId, BigDecimal amount,
                           SellerWallet.WalletBucket sourceBucket, SellerWallet.HoldStatus status) {
            // intentionally empty - legacy tests supply their own port
        }

        @Override
        public Optional<HoldRecord> find(UUID holdId) {
            return Optional.empty();
        }

        @Override
        public List<HoldRecord> findHeldBySellerId(String sellerId) {
            return List.of();
        }
    }
}
