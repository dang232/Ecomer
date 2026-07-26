package com.vnshop.sellerfinanceservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.sellerfinanceservice.domain.FinancialAdjustment;
import com.vnshop.sellerfinanceservice.domain.LedgerJournal;
import com.vnshop.sellerfinanceservice.domain.LedgerJournalType;
import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.port.out.ChargebackHoldAllocationRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.FinanceEventInboxPort;
import com.vnshop.sellerfinanceservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class ApplyFinancialAdjustmentUseCaseTest {

    private static final BigDecimal HUNDRED = new BigDecimal("100.00");
    private static final BigDecimal NINETY = new BigDecimal("90.00");
    private static final BigDecimal FORTY = new BigDecimal("40.00");
    private static final BigDecimal TEN = new BigDecimal("10.00");

    @Test
    void appliesCreditOnceAndReturnsTheExistingResultOnEventReplay() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        FinancialAdjustment adjustment = newCredit(UUID.randomUUID(), UUID.randomUUID());

        ApplyFinancialAdjustmentUseCase.ApplyResult first = useCase.apply(adjustment);
        ApplyFinancialAdjustmentUseCase.ApplyResult replay = useCase.apply(adjustment);
        SellerWallet wallet = wallets.findBySellerId(adjustment.sellerId()).orElseThrow();

        assertThat(replay).isEqualTo(first);
        assertThat(journals.saved).hasSize(1);
        assertThat(inbox.saved).hasSize(1);
        assertThat(wallet.settlementPendingBalance()).isEqualByComparingTo(NINETY);
        assertThat(wallet.totalFees()).isEqualByComparingTo(TEN);
    }

    @Test
    void releasesPendingFundsIntoAvailableFunds() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        UUID orderId = UUID.randomUUID();
        useCase.apply(newCredit(UUID.randomUUID(), orderId));

        FinancialAdjustment release = newRelease(UUID.randomUUID(), orderId);
        ApplyFinancialAdjustmentUseCase.ApplyResult result = useCase.apply(release);
        SellerWallet wallet = wallets.findBySellerId(release.sellerId()).orElseThrow();

        assertThat(result.journalId()).isNotNull();
        assertThat(wallet.settlementPendingBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.availableBalance()).isEqualByComparingTo(NINETY);
        assertThat(wallet.projectionEquationHolds()).isTrue();
    }

    @Test
    void chargebackHoldMovesFromAvailableIntoReserveAndRecordsAllocation() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        UUID orderId = UUID.randomUUID();
        useCase.apply(newCredit(UUID.randomUUID(), orderId));
        useCase.apply(newRelease(UUID.randomUUID(), orderId));

        UUID holdId = UUID.randomUUID();
        FinancialAdjustment hold = newChargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE);
        useCase.apply(hold);

        SellerWallet wallet = wallets.findBySellerId(hold.sellerId()).orElseThrow();
        assertThat(wallet.availableBalance()).isEqualByComparingTo("50.00");
        assertThat(wallet.reserveBalance()).isEqualByComparingTo(FORTY);
        assertThat(wallet.projectionEquationHolds()).isTrue();
        assertThat(holds.find(holdId)).isPresent();
        assertThat(holds.find(holdId).get().status()).isEqualTo(SellerWallet.HoldStatus.HELD);
    }

    @Test
    void chargebackReleaseReversesExactlyTheRecordedSourceBucket() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        UUID orderId = UUID.randomUUID();
        useCase.apply(newCredit(UUID.randomUUID(), orderId));
        useCase.apply(newRelease(UUID.randomUUID(), orderId));

        UUID holdId = UUID.randomUUID();
        useCase.apply(newChargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE));
        useCase.apply(newChargebackRelease(UUID.randomUUID(), orderId, holdId));

        SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
        assertThat(wallet.availableBalance()).isEqualByComparingTo(NINETY);
        assertThat(wallet.reserveBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.projectionEquationHolds()).isTrue();
        assertThat(holds.find(holdId).get().status()).isEqualTo(SellerWallet.HoldStatus.RELEASED);
    }

    @Test
    void refundAfterPayoutReservationCannotReducePayoutPending() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        UUID orderId = UUID.randomUUID();
        useCase.apply(newCredit(UUID.randomUUID(), orderId));
        useCase.apply(newRelease(UUID.randomUUID(), orderId));

        // payout reservation is handled outside the use case; model it here for the regression.
        SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
        wallet.reservePayout(FORTY);
        wallets.save(wallet);

        FinancialAdjustment refund = newRefundReversal(UUID.randomUUID(), orderId, HUNDRED);
        useCase.apply(refund);

        SellerWallet after = wallets.findBySellerId("seller-1").orElseThrow();
        // Payout reservation must NOT be tapped by the refund (90 - 40 reserved = 50 in available;
        // 100 - 50 consumed = 50 in debt because payout-pending is intentionally not a refund source).
        assertThat(after.availableBalance()).isEqualByComparingTo("0.00");
        assertThat(after.payoutPendingBalance()).isEqualByComparingTo(FORTY);
        assertThat(after.debtBalance()).isEqualByComparingTo("50.00");
        assertThat(after.projectionEquationHolds()).isTrue();
    }

    @Test
    void journalPostingsBalancePerCurrencyForEveryRecordedJournal() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        UUID orderId = UUID.randomUUID();
        useCase.apply(newCredit(UUID.randomUUID(), orderId));
        useCase.apply(newRelease(UUID.randomUUID(), orderId));

        UUID holdId = UUID.randomUUID();
        useCase.apply(newChargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE));
        useCase.apply(newChargebackRelease(UUID.randomUUID(), orderId, holdId));
        useCase.apply(newRefundReversal(UUID.randomUUID(), orderId, new BigDecimal("60.00")));

        for (LedgerJournal journal : journals.saved.values()) {
            assertThat(journal.isBalanced())
                    .as("journal %s must balance per currency", journal.journalType())
                    .isTrue();
        }
    }

    @Test
    void replayReturnsSameJournalIdWithoutReproducingPostings() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        UUID orderId = UUID.randomUUID();
        useCase.apply(newCredit(UUID.randomUUID(), orderId));
        FinancialAdjustment release = newRelease(UUID.randomUUID(), orderId);
        ApplyFinancialAdjustmentUseCase.ApplyResult first = useCase.apply(release);
        ApplyFinancialAdjustmentUseCase.ApplyResult replay = useCase.apply(release);

        assertThat(replay.journalId()).isEqualTo(first.journalId());
        assertThat(journals.saved).hasSize(2);
    }

    @Test
    void failureAfterJournalRollsBackTheEntireOperation() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(
                journals, inbox, wallets, holds,
                point -> { if (point == ApplyFinancialAdjustmentUseCase.FailurePoint.AFTER_JOURNAL) {
                    throw new RuntimeException("boom");
                } });
        UUID orderId = UUID.randomUUID();
        FinancialAdjustment credit = newCredit(UUID.randomUUID(), orderId);

        assertThatThrownBy(() -> useCase.apply(credit)).isInstanceOf(RuntimeException.class);
        // Projection must not have been touched; the wallet must be absent or unchanged.
        assertThat(wallets.findBySellerId(credit.sellerId())).isEmpty();
        assertThat(inbox.saved).doesNotContainKey(credit.eventId());
    }

    @Test
    void failureAfterProjectionRollsBackTheEntireOperation() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(
                journals, inbox, wallets, holds,
                point -> { if (point == ApplyFinancialAdjustmentUseCase.FailurePoint.AFTER_PROJECTION) {
                    throw new RuntimeException("boom-after-projection");
                } });
        UUID orderId = UUID.randomUUID();
        FinancialAdjustment credit = newCredit(UUID.randomUUID(), orderId);

        assertThatThrownBy(() -> useCase.apply(credit)).isInstanceOf(RuntimeException.class);
        // In-memory; the hook invocation triggers the throw. The wallet save must NOT have happened.
        assertThat(wallets.findBySellerId(credit.sellerId())).isEmpty();
        // Similarly the inbox must not have been recorded.
        assertThat(inbox.saved).doesNotContainKey(credit.eventId());
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("operationTable")
    void everyOperationBalancesWalletAndJournalByCurrency(String label, ScenarioHarness harness) {
        // 1. Journal must balance per currency.
        assertThat(harness.lastJournal.isBalanced())
                .as(label + " journal must balance per currency")
                .isTrue();
        // 2. Wallet projection equation must hold across every operation.
        assertThat(harness.wallet.projectionEquationHolds())
                .as(label + " projection equation must hold")
                .isTrue();
        // 3. Journal postings must exactly match the expected per-currency postings.
        assertThat(harness.lastJournal.postings())
                .as(label + " postings")
                .containsExactlyInAnyOrderElementsOf(harness.expectedPostings());
        // 4. Wallet bucket delta must match the expected projection.
        SellerWallet w = harness.wallet;
        assertThat(w.settlementPendingBalance()).as(label + " settlementPending")
                .isEqualByComparingTo(harness.expectedSettlementPending());
        assertThat(w.availableBalance()).as(label + " available")
                .isEqualByComparingTo(harness.expectedAvailable());
        assertThat(w.reserveBalance()).as(label + " reserve")
                .isEqualByComparingTo(harness.expectedReserve());
        assertThat(w.payoutPendingBalance()).as(label + " payoutPending")
                .isEqualByComparingTo(harness.expectedPayoutPending());
        assertThat(w.debtBalance()).as(label + " debt")
                .isEqualByComparingTo(harness.expectedDebt());
    }

    private static Stream<Arguments> operationTable() {
        return Stream.of(
                Arguments.of("credit 100, 10 commission", buildCredit()),
                Arguments.of("release 100", buildRelease()),
                Arguments.of("refund reversal 60", buildRefundReversal()),
                Arguments.of("chargeback hold from available", buildChargebackHoldFromAvailable()),
                Arguments.of("chargeback hold from settlement-pending", buildChargebackHoldFromSettlementPending()),
                Arguments.of("chargeback hold == release round-trip", buildChargebackHoldAndRelease()),
                Arguments.of("chargeback finalize consumes reserve", buildChargebackFinalize())
        );
    }

    // ---- table-driven scenario builders ----

    private static ScenarioHarness buildCredit() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        useCase.apply(newCredit(UUID.randomUUID(), UUID.randomUUID()));
        SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
        LedgerJournal journal = journals.saved.values().iterator().next();
        return new ScenarioHarness(wallet, journal,
                List.of(
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.MARKETPLACE_CLEARING,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.DEBIT, HUNDRED, "VND"),
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.SELLER_SETTLEMENT_PENDING,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.CREDIT, NINETY, "VND"),
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.PLATFORM_COMMISSION_REVENUE,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.CREDIT, TEN, "VND")),
                NINETY, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    private static ScenarioHarness buildRelease() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        UUID orderId = UUID.randomUUID();
        useCase.apply(newCredit(UUID.randomUUID(), orderId));
        useCase.apply(newRelease(UUID.randomUUID(), orderId));
        SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
        LedgerJournal journal = journals.saved.values().stream()
                .filter(j -> j.journalType() == LedgerJournalType.SETTLEMENT_RELEASE)
                .findFirst().orElseThrow();
        return new ScenarioHarness(wallet, journal,
                List.of(
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.SELLER_SETTLEMENT_PENDING,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.DEBIT, NINETY, "VND"),
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.SELLER_AVAILABLE,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.CREDIT, NINETY, "VND")),
                BigDecimal.ZERO, NINETY, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    private static ScenarioHarness buildRefundReversal() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        UUID orderId = UUID.randomUUID();
        BigDecimal refundAmount = new BigDecimal("60.00");
        useCase.apply(newCredit(UUID.randomUUID(), orderId));
        useCase.apply(newRefundReversal(UUID.randomUUID(), orderId, refundAmount));
        SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
        LedgerJournal journal = journals.saved.values().stream()
                .filter(j -> j.journalType() == LedgerJournalType.REFUND_REVERSAL)
                .findFirst().orElseThrow();
        return new ScenarioHarness(wallet, journal,
                List.of(
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.SELLER_SETTLEMENT_PENDING,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.DEBIT, refundAmount, "VND"),
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.MARKETPLACE_CLEARING,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.CREDIT, refundAmount, "VND")),
                new BigDecimal("30.00"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    private static ScenarioHarness buildChargebackHoldFromAvailable() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        UUID orderId = UUID.randomUUID();
        useCase.apply(newCredit(UUID.randomUUID(), orderId));
        useCase.apply(newRelease(UUID.randomUUID(), orderId));
        useCase.apply(newChargebackHold(UUID.randomUUID(), orderId, UUID.randomUUID(),
                SellerWallet.WalletBucket.AVAILABLE));
        SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
        LedgerJournal journal = journals.saved.values().stream()
                .filter(j -> j.journalType() == LedgerJournalType.CHARGEBACK_HOLD)
                .findFirst().orElseThrow();
        return new ScenarioHarness(wallet, journal,
                List.of(
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.SELLER_AVAILABLE,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.DEBIT, FORTY, "VND"),
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.SELLER_RESERVE,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.CREDIT, FORTY, "VND")),
                BigDecimal.ZERO, new BigDecimal("50.00"), FORTY, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    private static ScenarioHarness buildChargebackHoldFromSettlementPending() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        UUID orderId = UUID.randomUUID();
        useCase.apply(newCredit(UUID.randomUUID(), orderId));
        useCase.apply(newChargebackHold(UUID.randomUUID(), orderId, UUID.randomUUID(),
                SellerWallet.WalletBucket.SETTLEMENT_PENDING));
        SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
        LedgerJournal journal = journals.saved.values().stream()
                .filter(j -> j.journalType() == LedgerJournalType.CHARGEBACK_HOLD)
                .findFirst().orElseThrow();
        return new ScenarioHarness(wallet, journal,
                List.of(
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.SELLER_SETTLEMENT_PENDING,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.DEBIT, FORTY, "VND"),
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.SELLER_RESERVE,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.CREDIT, FORTY, "VND")),
                new BigDecimal("50.00"), BigDecimal.ZERO, FORTY, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    private static ScenarioHarness buildChargebackHoldAndRelease() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        UUID orderId = UUID.randomUUID();
        useCase.apply(newCredit(UUID.randomUUID(), orderId));
        useCase.apply(newRelease(UUID.randomUUID(), orderId));
        UUID holdId = UUID.randomUUID();
        useCase.apply(newChargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE));
        useCase.apply(newChargebackRelease(UUID.randomUUID(), orderId, holdId));
        SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
        LedgerJournal journal = journals.saved.values().stream()
                .filter(j -> j.journalType() == LedgerJournalType.CHARGEBACK_RELEASE)
                .findFirst().orElseThrow();
        return new ScenarioHarness(wallet, journal,
                List.of(
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.SELLER_RESERVE,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.DEBIT, FORTY, "VND"),
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.SELLER_AVAILABLE,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.CREDIT, FORTY, "VND")),
                BigDecimal.ZERO, NINETY, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    private static ScenarioHarness buildChargebackFinalize() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        UUID orderId = UUID.randomUUID();
        useCase.apply(newCredit(UUID.randomUUID(), orderId));
        useCase.apply(newRelease(UUID.randomUUID(), orderId));
        UUID holdId = UUID.randomUUID();
        useCase.apply(newChargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE));
        useCase.apply(newChargebackFinalize(UUID.randomUUID(), orderId, holdId));
        SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
        LedgerJournal journal = journals.saved.values().stream()
                .filter(j -> j.journalType() == LedgerJournalType.CHARGEBACK_FINALIZE)
                .findFirst().orElseThrow();
        return new ScenarioHarness(wallet, journal,
                List.of(
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.SELLER_RESERVE,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.DEBIT, FORTY, "VND"),
                        new com.vnshop.sellerfinanceservice.domain.LedgerPosting(
                                com.vnshop.sellerfinanceservice.domain.LedgerAccountCode.MARKETPLACE_CLEARING,
                                com.vnshop.sellerfinanceservice.domain.LedgerDirection.CREDIT, FORTY, "VND")),
                BigDecimal.ZERO, new BigDecimal("50.00"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    // ---- FinancialAdjustment factories (renamed to avoid shadowing) ----

    private static FinancialAdjustment newCredit(UUID eventId, UUID orderId) {
        return new FinancialAdjustment(
                eventId, Instant.parse("2026-07-24T00:00:00Z"), UUID.randomUUID(),
                FinancialAdjustment.AdjustmentType.CREDIT, UUID.randomUUID(), 1, orderId, 42L,
                "seller-1", "STANDARD", new BigDecimal("0.10"), null, "VND",
                components(), null);
    }

    private static FinancialAdjustment newRelease(UUID eventId, UUID orderId) {
        return new FinancialAdjustment(
                eventId, Instant.parse("2026-07-24T00:00:00Z"), UUID.randomUUID(),
                FinancialAdjustment.AdjustmentType.RELEASE, UUID.randomUUID(), 1, orderId, 42L,
                "seller-1", "STANDARD", new BigDecimal("0.10"), null, "VND",
                components(), new FinancialAdjustment.ReleaseMetadata("BUYER_CONFIRMED", "buyer-1", Instant.now()));
    }

    private static FinancialAdjustment newRefundReversal(UUID eventId, UUID orderId, BigDecimal amount) {
        FinancialAdjustment.Components comp = new FinancialAdjustment.Components(
                amount, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, amount, BigDecimal.ZERO, amount, amount, "VND");
        return new FinancialAdjustment(
                eventId, Instant.parse("2026-07-24T00:00:00Z"), UUID.randomUUID(),
                FinancialAdjustment.AdjustmentType.REFUND_REVERSAL, UUID.randomUUID(), 1, orderId, 42L,
                "seller-1", "STANDARD", new BigDecimal("0.0"), UUID.randomUUID(), "VND",
                comp, null);
    }

    private static FinancialAdjustment newChargebackHold(UUID eventId, UUID orderId, UUID holdId,
                                                          SellerWallet.WalletBucket source) {
        FinancialAdjustment.Components comp = new FinancialAdjustment.Components(
                FORTY, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, FORTY, BigDecimal.ZERO, FORTY, FORTY, "VND", source);
        return new FinancialAdjustment(
                eventId, Instant.parse("2026-07-24T00:00:00Z"), UUID.randomUUID(),
                FinancialAdjustment.AdjustmentType.CHARGEBACK_HOLD, UUID.randomUUID(), 1, orderId, 42L,
                "seller-1", "STANDARD", new BigDecimal("0.0"), holdId, "VND",
                comp, null);
    }

    private static FinancialAdjustment newChargebackRelease(UUID eventId, UUID orderId, UUID holdId) {
        FinancialAdjustment.Components comp = new FinancialAdjustment.Components(
                FORTY, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, FORTY, BigDecimal.ZERO, FORTY, FORTY, "VND");
        return new FinancialAdjustment(
                eventId, Instant.parse("2026-07-24T00:00:00Z"), UUID.randomUUID(),
                FinancialAdjustment.AdjustmentType.CHARGEBACK_RELEASE, UUID.randomUUID(), 1, orderId, 42L,
                "seller-1", "STANDARD", new BigDecimal("0.0"), holdId, "VND",
                comp, null);
    }

    private static FinancialAdjustment newChargebackFinalize(UUID eventId, UUID orderId, UUID holdId) {
        FinancialAdjustment.Components comp = new FinancialAdjustment.Components(
                FORTY, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, FORTY, BigDecimal.ZERO, FORTY, FORTY, "VND");
        return new FinancialAdjustment(
                eventId, Instant.parse("2026-07-24T00:00:00Z"), UUID.randomUUID(),
                FinancialAdjustment.AdjustmentType.CHARGEBACK_FINALIZE, UUID.randomUUID(), 1, orderId, 42L,
                "seller-1", "STANDARD", new BigDecimal("0.0"), holdId, "VND",
                comp, null);
    }

    private static FinancialAdjustment.Components components() {
        return new FinancialAdjustment.Components(
                HUNDRED, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, HUNDRED,
                TEN, NINETY, HUNDRED, "VND");
    }

    private record ScenarioHarness(
            SellerWallet wallet,
            LedgerJournal lastJournal,
            List<com.vnshop.sellerfinanceservice.domain.LedgerPosting> expectedPostings,
            BigDecimal expectedSettlementPending,
            BigDecimal expectedAvailable,
            BigDecimal expectedReserve,
            BigDecimal expectedPayoutPending,
            BigDecimal expectedDebt) {
    }

    private static final class InMemoryLedgerRepository implements LedgerRepositoryPort {
        private final Map<String, LedgerJournal> saved = new HashMap<>();
        private final Map<String, List<LedgerJournal>> byInputSource = new HashMap<>();

        @Override
        public Optional<LedgerJournal> findBySourceOperation(String sourceType, UUID sourceId, String operationType) {
            return saved.values().stream().filter(journal -> journal.hasSourceOperation(sourceType, sourceId, operationType)).findFirst();
        }

        @Override
        public LedgerJournal save(LedgerJournal journal) {
            saved.put(journal.journalId().toString(), journal);
            byInputSource.computeIfAbsent(key(journal.sourceType(), journal.sourceId(), journal.operationType()),
                    ignored -> new ArrayList<>()).add(journal);
            return journal;
        }

        @Override
        public List<LedgerJournal> findBySellerId(String sellerId) {
            return saved.values().stream().filter(j -> j.sellerId().equals(sellerId)).toList();
        }

        private static String key(String sourceType, UUID sourceId, String operationType) {
            return sourceType + "/" + sourceId + "/" + operationType;
        }
    }

    private static final class InMemoryInboxRepository implements FinanceEventInboxPort {
        private final Map<UUID, UUID> saved = new HashMap<>();

        @Override
        public Optional<UUID> findJournalIdByEventId(UUID eventId) {
            return Optional.ofNullable(saved.get(eventId));
        }

        @Override
        public void record(UUID eventId, UUID journalId) {
            saved.put(eventId, journalId);
        }
    }

    private static final class InMemoryWalletRepository implements SellerWalletRepositoryPort {
        private final Map<String, SellerWallet> saved = new HashMap<>();

        @Override
        public Optional<SellerWallet> findBySellerId(String sellerId) {
            return Optional.ofNullable(saved.get(sellerId));
        }

        @Override
        public Optional<SellerWallet> findBySellerIdForUpdate(String sellerId) {
            return findBySellerId(sellerId);
        }

        @Override
        public SellerWallet save(SellerWallet wallet) {
            saved.put(wallet.sellerId(), wallet);
            return wallet;
        }
    }

    private static final class InMemoryHoldRepository implements ChargebackHoldAllocationRepositoryPort {
        private final Map<UUID, HoldRecord> records = new HashMap<>();

        @Override
        public synchronized void record(UUID holdId, String sellerId, BigDecimal amount,
                                        SellerWallet.WalletBucket sourceBucket, SellerWallet.HoldStatus status) {
            records.put(holdId, new HoldRecord(holdId, sellerId, amount, sourceBucket, status));
        }

        @Override
        public Optional<HoldRecord> find(UUID holdId) {
            return Optional.ofNullable(records.get(holdId));
        }

        @Override
        public List<HoldRecord> findHeldBySellerId(String sellerId) {
            return records.values().stream()
                    .filter(record -> record.sellerId().equals(sellerId)
                            && record.status() == SellerWallet.HoldStatus.HELD)
                    .toList();
        }
    }
}
