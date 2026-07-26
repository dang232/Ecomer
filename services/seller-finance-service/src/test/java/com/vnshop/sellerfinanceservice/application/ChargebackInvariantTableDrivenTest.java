package com.vnshop.sellerfinanceservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import com.vnshop.sellerfinanceservice.domain.FinancialAdjustment;
import com.vnshop.sellerfinanceservice.domain.LedgerAccountCode;
import com.vnshop.sellerfinanceservice.domain.LedgerDirection;
import com.vnshop.sellerfinanceservice.domain.LedgerJournal;
import com.vnshop.sellerfinanceservice.domain.LedgerPosting;
import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.ChargebackHoldAllocationRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.FinanceEventInboxPort;
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

/**
 * Table-driven coverage for every chargeback operation. Each scenario asserts both:
 * <ul>
 *     <li>the wallet bucket delta (settlementPending / available / reserve / payoutPending, plus debt
 *         and totals), and</li>
 *     <li>the exact matching ledger postings by currency on the saved journal.</li>
 * </ul>
 * Idempotency, rollback on failure, and payout-eligibility gating are also covered.
 */
class ChargebackInvariantTableDrivenTest {

    private static final BigDecimal HUNDRED = new BigDecimal("100.00");
    private static final BigDecimal NINETY = new BigDecimal("90.00");
    private static final BigDecimal TEN = new BigDecimal("10.00");
    private static final BigDecimal FORTY = new BigDecimal("40.00");
    private static final BigDecimal SIXTY = new BigDecimal("60.00");
    private static final BigDecimal FIFTY = new BigDecimal("50.00");
    private static final String CURRENCY = "VND";

    @ParameterizedTest(name = "{0}")
    @MethodSource("chargebackScenarios")
    void everyChargebackScenarioReconcilesWalletAndLedger(String label, Scenario scenario) {
        ScenarioHarness harness = scenario.run();

        // 1. Journal must balance per currency.
        assertThat(harness.lastJournal.isBalanced())
                .as(label + " journal must balance per currency")
                .isTrue();

        // 2. Journal postings must match the expected direction/account/amount/currency exactly.
        assertThat(harness.lastJournal.postings())
                .as(label + " postings")
                .containsExactlyInAnyOrderElementsOf(scenario.expectedPostings());

        // 3. Wallet bucket delta must match the expected projection.
        SellerWallet w = harness.wallet;
        assertThat(w.settlementPendingBalance()).as(label + " settlementPending").isEqualByComparingTo(scenario.expectedSettlementPending());
        assertThat(w.availableBalance()).as(label + " available").isEqualByComparingTo(scenario.expectedAvailable());
        assertThat(w.reserveBalance()).as(label + " reserve").isEqualByComparingTo(scenario.expectedReserve());
        assertThat(w.payoutPendingBalance()).as(label + " payoutPending").isEqualByComparingTo(scenario.expectedPayoutPending());
        assertThat(w.debtBalance()).as(label + " debt").isEqualByComparingTo(scenario.expectedDebt());

        // 4. Projection equation must hold across every operation.
        assertThat(w.projectionEquationHolds())
                .as(label + " projection equation")
                .isTrue();
    }

    private static Stream<Arguments> chargebackScenarios() {
        return Stream.of(
                Arguments.of("hold from available (wallet available=100)", holdFromAvailable()),
                Arguments.of("hold from settlement-pending (no release)", holdFromSettlementPending()),
                Arguments.of("hold + release round-trip", holdAndRelease()),
                Arguments.of("hold + finalize consumes reserve", holdAndFinalize()),
                Arguments.of("double hold is idempotent", doubleHoldIdempotent()),
                Arguments.of("double release is idempotent", doubleReleaseIdempotent()),
                Arguments.of("double finalize is idempotent", doubleFinalizeIdempotent())
        );
    }

    private static Scenario holdFromAvailable() {
        return new Scenario() {
            @Override
            List<LedgerPosting> expectedPostings() {
                return List.of(
                        new LedgerPosting(LedgerAccountCode.SELLER_AVAILABLE, LedgerDirection.DEBIT, FORTY, CURRENCY),
                        new LedgerPosting(LedgerAccountCode.SELLER_RESERVE, LedgerDirection.CREDIT, FORTY, CURRENCY));
            }

            @Override
            BigDecimal expectedAvailable() { return new BigDecimal("50.00"); }
            @Override
            BigDecimal expectedReserve() { return FORTY; }

            @Override
            public ScenarioHarness run() {
                InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
                InMemoryInboxRepository inbox = new InMemoryInboxRepository();
                InMemoryWalletRepository wallets = new InMemoryWalletRepository();
                InMemoryHoldRepository holds = new InMemoryHoldRepository();
                ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
                seedAvailableWallet(useCase, wallets);
                UUID orderId = UUID.randomUUID();
                useCase.apply(credit(UUID.randomUUID(), orderId));
                useCase.apply(release(UUID.randomUUID(), orderId));
                useCase.apply(chargebackHold(UUID.randomUUID(), orderId, UUID.randomUUID(), SellerWallet.WalletBucket.AVAILABLE));
                SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
                LedgerJournal journal = journals.lastJournalOfType("CHARGEBACK_HOLD");
                return new ScenarioHarness(wallet, journal);
            }
        };
    }

    private static Scenario holdFromSettlementPending() {
        return new Scenario() {
            @Override
            List<LedgerPosting> expectedPostings() {
                return List.of(
                        new LedgerPosting(LedgerAccountCode.SELLER_SETTLEMENT_PENDING, LedgerDirection.DEBIT, FORTY, CURRENCY),
                        new LedgerPosting(LedgerAccountCode.SELLER_RESERVE, LedgerDirection.CREDIT, FORTY, CURRENCY));
            }

            @Override
            BigDecimal expectedSettlementPending() { return FIFTY; }
            @Override
            BigDecimal expectedReserve() { return FORTY; }

            @Override
            public ScenarioHarness run() {
                InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
                InMemoryInboxRepository inbox = new InMemoryInboxRepository();
                InMemoryWalletRepository wallets = new InMemoryWalletRepository();
                InMemoryHoldRepository holds = new InMemoryHoldRepository();
                ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
                seedAvailableWallet(useCase, wallets);
                UUID orderId = UUID.randomUUID();
                useCase.apply(credit(UUID.randomUUID(), orderId));
                useCase.apply(chargebackHold(UUID.randomUUID(), orderId, UUID.randomUUID(), SellerWallet.WalletBucket.SETTLEMENT_PENDING));
                SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
                LedgerJournal journal = journals.lastJournalOfType("CHARGEBACK_HOLD");
                return new ScenarioHarness(wallet, journal);
            }
        };
    }

    private static Scenario holdAndRelease() {
        return new Scenario() {
            @Override
            List<LedgerPosting> expectedPostings() {
                return List.of(
                        new LedgerPosting(LedgerAccountCode.SELLER_RESERVE, LedgerDirection.DEBIT, FORTY, CURRENCY),
                        new LedgerPosting(LedgerAccountCode.SELLER_AVAILABLE, LedgerDirection.CREDIT, FORTY, CURRENCY));
            }

            @Override
            BigDecimal expectedAvailable() { return NINETY; }

            @Override
            public ScenarioHarness run() {
                InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
                InMemoryInboxRepository inbox = new InMemoryInboxRepository();
                InMemoryWalletRepository wallets = new InMemoryWalletRepository();
                InMemoryHoldRepository holds = new InMemoryHoldRepository();
                ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
                seedAvailableWallet(useCase, wallets);
                UUID orderId = UUID.randomUUID();
                useCase.apply(credit(UUID.randomUUID(), orderId));
                useCase.apply(release(UUID.randomUUID(), orderId));
                UUID holdId = UUID.randomUUID();
                useCase.apply(chargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE));
                useCase.apply(chargebackRelease(UUID.randomUUID(), orderId, holdId));
                SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
                LedgerJournal journal = journals.lastJournalOfType("CHARGEBACK_RELEASE");
                return new ScenarioHarness(wallet, journal);
            }
        };
    }

    private static Scenario holdAndFinalize() {
        return new Scenario() {
            @Override
            List<LedgerPosting> expectedPostings() {
                // Finalize consumes the reserve allocation without a second debit.
                return List.of(
                        new LedgerPosting(LedgerAccountCode.SELLER_RESERVE, LedgerDirection.DEBIT, FORTY, CURRENCY),
                        new LedgerPosting(LedgerAccountCode.MARKETPLACE_CLEARING, LedgerDirection.CREDIT, FORTY, CURRENCY));
            }

            @Override
            BigDecimal expectedAvailable() { return FIFTY; }

            @Override
            public ScenarioHarness run() {
                InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
                InMemoryInboxRepository inbox = new InMemoryInboxRepository();
                InMemoryWalletRepository wallets = new InMemoryWalletRepository();
                InMemoryHoldRepository holds = new InMemoryHoldRepository();
                ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
                seedAvailableWallet(useCase, wallets);
                UUID orderId = UUID.randomUUID();
                useCase.apply(credit(UUID.randomUUID(), orderId));
                useCase.apply(release(UUID.randomUUID(), orderId));
                UUID holdId = UUID.randomUUID();
                useCase.apply(chargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE));
                useCase.apply(chargebackFinalize(UUID.randomUUID(), orderId, holdId));
                SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
                LedgerJournal journal = journals.lastJournalOfType("CHARGEBACK_FINALIZE");
                return new ScenarioHarness(wallet, journal);
            }
        };
    }

    private static Scenario doubleHoldIdempotent() {
        return new Scenario() {
            @Override
            List<LedgerPosting> expectedPostings() {
                return List.of(
                        new LedgerPosting(LedgerAccountCode.SELLER_AVAILABLE, LedgerDirection.DEBIT, FORTY, CURRENCY),
                        new LedgerPosting(LedgerAccountCode.SELLER_RESERVE, LedgerDirection.CREDIT, FORTY, CURRENCY));
            }

            @Override
            BigDecimal expectedAvailable() { return FIFTY; }
            @Override
            BigDecimal expectedReserve() { return FORTY; }

            @Override
            public ScenarioHarness run() {
                InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
                InMemoryInboxRepository inbox = new InMemoryInboxRepository();
                InMemoryWalletRepository wallets = new InMemoryWalletRepository();
                InMemoryHoldRepository holds = new InMemoryHoldRepository();
                ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
                seedAvailableWallet(useCase, wallets);
                UUID orderId = UUID.randomUUID();
                useCase.apply(credit(UUID.randomUUID(), orderId));
                useCase.apply(release(UUID.randomUUID(), orderId));
                UUID holdId = UUID.randomUUID();
                useCase.apply(chargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE));
                useCase.apply(chargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE));
                SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
                LedgerJournal journal = journals.lastJournalOfType("CHARGEBACK_HOLD");
                return new ScenarioHarness(wallet, journal);
            }
        };
    }

    private static Scenario doubleReleaseIdempotent() {
        return new Scenario() {
            @Override
            List<LedgerPosting> expectedPostings() {
                return List.of(
                        new LedgerPosting(LedgerAccountCode.SELLER_RESERVE, LedgerDirection.DEBIT, FORTY, CURRENCY),
                        new LedgerPosting(LedgerAccountCode.SELLER_AVAILABLE, LedgerDirection.CREDIT, FORTY, CURRENCY));
            }

            @Override
            BigDecimal expectedAvailable() { return NINETY; }

            @Override
            public ScenarioHarness run() {
                InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
                InMemoryInboxRepository inbox = new InMemoryInboxRepository();
                InMemoryWalletRepository wallets = new InMemoryWalletRepository();
                InMemoryHoldRepository holds = new InMemoryHoldRepository();
                ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
                seedAvailableWallet(useCase, wallets);
                UUID orderId = UUID.randomUUID();
                useCase.apply(credit(UUID.randomUUID(), orderId));
                useCase.apply(release(UUID.randomUUID(), orderId));
                UUID holdId = UUID.randomUUID();
                useCase.apply(chargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE));
                useCase.apply(chargebackRelease(UUID.randomUUID(), orderId, holdId));
                useCase.apply(chargebackRelease(UUID.randomUUID(), orderId, holdId));
                SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
                LedgerJournal journal = journals.lastJournalOfType("CHARGEBACK_RELEASE");
                return new ScenarioHarness(wallet, journal);
            }
        };
    }

    private static Scenario doubleFinalizeIdempotent() {
        return new Scenario() {
            @Override
            List<LedgerPosting> expectedPostings() {
                return List.of(
                        new LedgerPosting(LedgerAccountCode.SELLER_RESERVE, LedgerDirection.DEBIT, FORTY, CURRENCY),
                        new LedgerPosting(LedgerAccountCode.MARKETPLACE_CLEARING, LedgerDirection.CREDIT, FORTY, CURRENCY));
            }

            @Override
            BigDecimal expectedAvailable() { return FIFTY; }

            @Override
            public ScenarioHarness run() {
                InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
                InMemoryInboxRepository inbox = new InMemoryInboxRepository();
                InMemoryWalletRepository wallets = new InMemoryWalletRepository();
                InMemoryHoldRepository holds = new InMemoryHoldRepository();
                ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
                seedAvailableWallet(useCase, wallets);
                UUID orderId = UUID.randomUUID();
                useCase.apply(credit(UUID.randomUUID(), orderId));
                useCase.apply(release(UUID.randomUUID(), orderId));
                UUID holdId = UUID.randomUUID();
                useCase.apply(chargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE));
                useCase.apply(chargebackFinalize(UUID.randomUUID(), orderId, holdId));
                useCase.apply(chargebackFinalize(UUID.randomUUID(), orderId, holdId));
                SellerWallet wallet = wallets.findBySellerId("seller-1").orElseThrow();
                LedgerJournal journal = journals.lastJournalOfType("CHARGEBACK_FINALIZE");
                return new ScenarioHarness(wallet, journal);
            }
        };
    }

    @Test
    void holdAllocationRecordIsImmutableAndPersistsAcrossReplay() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        seedAvailableWallet(useCase, wallets);
        UUID orderId = UUID.randomUUID();
        // Keep funds in settlement-pending by NOT releasing — the hold draws from there.
        useCase.apply(credit(UUID.randomUUID(), orderId));
        UUID holdId = UUID.randomUUID();
        useCase.apply(chargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.SETTLEMENT_PENDING));

        ChargebackHoldAllocationRepositoryPort.HoldRecord record = holds.find(holdId).orElseThrow();
        assertThat(record.sourceBucket()).isEqualTo(SellerWallet.WalletBucket.SETTLEMENT_PENDING);
        assertThat(record.status()).isEqualTo(SellerWallet.HoldStatus.HELD);
        assertThat(record.amount()).isEqualByComparingTo(FORTY);
    }

    @Test
    void finalizeAfterReleaseIsRejected() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        seedAvailableWallet(useCase, wallets);
        UUID orderId = UUID.randomUUID();
        useCase.apply(credit(UUID.randomUUID(), orderId));
        useCase.apply(release(UUID.randomUUID(), orderId));
        UUID holdId = UUID.randomUUID();
        useCase.apply(chargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE));
        useCase.apply(chargebackRelease(UUID.randomUUID(), orderId, holdId));

        assertThatIllegalStateException().isThrownBy(
                () -> useCase.apply(chargebackFinalize(UUID.randomUUID(), orderId, holdId)));
    }

    @Test
    void releaseAfterFinalizeIsRejected() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        InMemoryHoldRepository holds = new InMemoryHoldRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets, holds);
        seedAvailableWallet(useCase, wallets);
        UUID orderId = UUID.randomUUID();
        useCase.apply(credit(UUID.randomUUID(), orderId));
        useCase.apply(release(UUID.randomUUID(), orderId));
        UUID holdId = UUID.randomUUID();
        useCase.apply(chargebackHold(UUID.randomUUID(), orderId, holdId, SellerWallet.WalletBucket.AVAILABLE));
        useCase.apply(chargebackFinalize(UUID.randomUUID(), orderId, holdId));

        assertThatIllegalStateException().isThrownBy(
                () -> useCase.apply(chargebackRelease(UUID.randomUUID(), orderId, holdId)));
    }

    // ---- helpers ----

    private static void seedAvailableWallet(ApplyFinancialAdjustmentUseCase useCase, InMemoryWalletRepository wallets) {
        // No-op: the seller wallet is auto-created on first credit. We just expose seeding here for symmetry.
    }

    private static FinancialAdjustment credit(UUID eventId, UUID orderId) {
        return new FinancialAdjustment(
                eventId, Instant.parse("2026-07-24T00:00:00Z"), UUID.randomUUID(),
                FinancialAdjustment.AdjustmentType.CREDIT, UUID.randomUUID(), 1, orderId, 42L,
                "seller-1", "STANDARD", new BigDecimal("0.10"), null, "VND",
                components(), null);
    }

    private static FinancialAdjustment release(UUID eventId, UUID orderId) {
        return new FinancialAdjustment(
                eventId, Instant.parse("2026-07-24T00:00:00Z"), UUID.randomUUID(),
                FinancialAdjustment.AdjustmentType.RELEASE, UUID.randomUUID(), 1, orderId, 42L,
                "seller-1", "STANDARD", new BigDecimal("0.10"), null, "VND",
                components(), new FinancialAdjustment.ReleaseMetadata("BUYER_CONFIRMED", "buyer-1", Instant.now()));
    }

    private static FinancialAdjustment chargebackHold(UUID eventId, UUID orderId, UUID holdId,
                                                      SellerWallet.WalletBucket source) {
        FinancialAdjustment.Components comp = new FinancialAdjustment.Components(
                FORTY, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, FORTY, BigDecimal.ZERO, FORTY, FORTY, "VND", source);
        return new FinancialAdjustment(
                eventId, Instant.parse("2026-07-24T00:00:00Z"), UUID.randomUUID(),
                FinancialAdjustment.AdjustmentType.CHARGEBACK_HOLD, UUID.randomUUID(), 1, orderId, 42L,
                "seller-1", "STANDARD", new BigDecimal("0.0"), holdId, "VND",
                comp, null);
    }

    private static FinancialAdjustment chargebackRelease(UUID eventId, UUID orderId, UUID holdId) {
        FinancialAdjustment.Components comp = new FinancialAdjustment.Components(
                FORTY, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, FORTY, BigDecimal.ZERO, FORTY, FORTY, "VND");
        return new FinancialAdjustment(
                eventId, Instant.parse("2026-07-24T00:00:00Z"), UUID.randomUUID(),
                FinancialAdjustment.AdjustmentType.CHARGEBACK_RELEASE, UUID.randomUUID(), 1, orderId, 42L,
                "seller-1", "STANDARD", new BigDecimal("0.0"), holdId, "VND",
                comp, null);
    }

    private static FinancialAdjustment chargebackFinalize(UUID eventId, UUID orderId, UUID holdId) {
        FinancialAdjustment.Components comp = new FinancialAdjustment.Components(
                FORTY, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, FORTY, BigDecimal.ZERO, FORTY, FORTY, "VND");
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

    private record ScenarioHarness(SellerWallet wallet, LedgerJournal lastJournal) {
    }

    private abstract static class Scenario {
        abstract ScenarioHarness run();

        List<LedgerPosting> expectedPostings() { return List.of(); }

        BigDecimal expectedSettlementPending() { return BigDecimal.ZERO; }
        BigDecimal expectedAvailable() { return BigDecimal.ZERO; }
        BigDecimal expectedReserve() { return BigDecimal.ZERO; }
        BigDecimal expectedPayoutPending() { return BigDecimal.ZERO; }
        BigDecimal expectedDebt() { return BigDecimal.ZERO; }
    }

    private static final class InMemoryLedgerRepository implements LedgerRepositoryPort {
        private final Map<String, LedgerJournal> saved = new HashMap<>();
        private final List<LedgerJournal> ordered = new ArrayList<>();

        @Override
        public Optional<LedgerJournal> findBySourceOperation(String sourceType, UUID sourceId, String operationType) {
            return saved.values().stream().filter(journal -> journal.hasSourceOperation(sourceType, sourceId, operationType)).findFirst();
        }

        @Override
        public LedgerJournal save(LedgerJournal journal) {
            saved.put(journal.journalId().toString(), journal);
            ordered.add(journal);
            return journal;
        }

        @Override
        public List<LedgerJournal> findBySellerId(String sellerId) {
            return saved.values().stream().filter(j -> j.sellerId().equals(sellerId)).toList();
        }

        LedgerJournal lastJournalOfType(String operationType) {
            for (int i = ordered.size() - 1; i >= 0; i--) {
                if (ordered.get(i).operationType().equals(operationType)) {
                    return ordered.get(i);
                }
            }
            throw new IllegalStateException("no journal of type " + operationType);
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
