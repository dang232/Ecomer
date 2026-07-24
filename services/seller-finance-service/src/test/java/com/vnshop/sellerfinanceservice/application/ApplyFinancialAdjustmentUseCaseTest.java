package com.vnshop.sellerfinanceservice.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.sellerfinanceservice.domain.FinancialAdjustment;
import com.vnshop.sellerfinanceservice.domain.LedgerJournal;
import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.port.out.FinanceEventInboxPort;
import com.vnshop.sellerfinanceservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ApplyFinancialAdjustmentUseCaseTest {

    @Test
    void appliesCreditOnceAndReturnsTheExistingResultOnEventReplay() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets);
        FinancialAdjustment adjustment = credit(UUID.randomUUID(), UUID.randomUUID());

        ApplyFinancialAdjustmentUseCase.ApplyResult first = useCase.apply(adjustment);
        ApplyFinancialAdjustmentUseCase.ApplyResult replay = useCase.apply(adjustment);
        SellerWallet wallet = wallets.findBySellerId(adjustment.sellerId()).orElseThrow();

        assertThat(replay).isEqualTo(first);
        assertThat(journals.saved).hasSize(1);
        assertThat(inbox.saved).hasSize(1);
        assertThat(wallet.settlementPendingBalance()).isEqualByComparingTo("90.00");
        assertThat(wallet.totalFees()).isEqualByComparingTo("10.00");
    }

    @Test
    void releasesPendingFundsIntoAvailableFunds() {
        InMemoryLedgerRepository journals = new InMemoryLedgerRepository();
        InMemoryInboxRepository inbox = new InMemoryInboxRepository();
        InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        ApplyFinancialAdjustmentUseCase useCase = new ApplyFinancialAdjustmentUseCase(journals, inbox, wallets);
        UUID orderId = UUID.randomUUID();
        useCase.apply(credit(UUID.randomUUID(), orderId));

        FinancialAdjustment release = release(UUID.randomUUID(), orderId);
        ApplyFinancialAdjustmentUseCase.ApplyResult result = useCase.apply(release);
        SellerWallet wallet = wallets.findBySellerId(release.sellerId()).orElseThrow();

        assertThat(result.journalId()).isNotNull();
        assertThat(wallet.settlementPendingBalance()).isEqualByComparingTo("0.00");
        assertThat(wallet.availableBalance()).isEqualByComparingTo("90.00");
        assertThat(wallet.projectionEquationHolds()).isTrue();
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

    private static FinancialAdjustment.Components components() {
        return new FinancialAdjustment.Components(
                new BigDecimal("100.00"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("100.00"),
                new BigDecimal("10.00"), new BigDecimal("90.00"), new BigDecimal("100.00"), "VND");
    }

    private static final class InMemoryLedgerRepository implements LedgerRepositoryPort {
        private final Map<String, LedgerJournal> saved = new HashMap<>();

        @Override
        public Optional<LedgerJournal> findBySourceOperation(String sourceType, UUID sourceId, String operationType) {
            return saved.values().stream().filter(journal -> journal.hasSourceOperation(sourceType, sourceId, operationType)).findFirst();
        }

        @Override
        public LedgerJournal save(LedgerJournal journal) {
            saved.put(journal.journalId().toString(), journal);
            return journal;
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
        public SellerWallet save(SellerWallet wallet) {
            saved.put(wallet.sellerId(), wallet);
            return wallet;
        }
    }
}
