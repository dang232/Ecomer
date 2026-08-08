package com.vnshop.sellerfinanceservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.sellerfinanceservice.domain.LedgerJournal;
import com.vnshop.sellerfinanceservice.domain.Payout;
import com.vnshop.sellerfinanceservice.domain.PayoutStatus;
import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationSnapshot;
import com.vnshop.sellerfinanceservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutDestinationClient;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutEligibilityPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutProviderQueryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutProviderPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PayoutUseCasesTest {

    private static final Instant NOW = Instant.parse("2026-07-26T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final PayoutDestinationSnapshot DESTINATION = new PayoutDestinationSnapshot(
            "snapshot-1", "seller-1", "destination-1", "v1.ciphertext", 1, "AES-256-GCM",
            "fingerprint-1", "1234", "Vietcombank", NOW, "k1.envelope");

    @Test
    void requestIsIdempotentAndCreatesOneReservationJournal() {
        Fixtures fixtures = new Fixtures();
        RequestPayoutUseCase useCase = fixtures.newRequestUseCase();

        Payout first = useCase.request("seller-1", new BigDecimal("25.00"), "VND", "request-1");
        Payout retry = useCase.request("seller-1", new BigDecimal("25.00"), "VND", "request-1");

        assertThat(first.status()).isEqualTo(PayoutStatus.REQUESTED);
        assertThat(retry.payoutId()).isEqualTo(first.payoutId());
        assertThat(fixtures.payouts.values.values()).hasSize(1);
        assertThat(fixtures.ledger.journals).hasSize(1);
        assertThat(fixtures.wallet.availableBalance()).isEqualByComparingTo("75.00");
        assertThat(fixtures.wallet.payoutPendingBalance()).isEqualByComparingTo("25.00");
        assertThat(fixtures.wallets.lockedLookups).isEqualTo(2);
    }

    @Test
    void reusingIdempotencyKeyWithDifferentTermsFails() {
        Fixtures fixtures = new Fixtures();
        RequestPayoutUseCase useCase = fixtures.newRequestUseCase();
        useCase.request("seller-1", new BigDecimal("25.00"), "VND", "request-1");

        assertThatThrownBy(() -> useCase.request("seller-1", new BigDecimal("30.00"), "VND", "request-1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("idempotency key");
    }

    @Test
    void canonicalFlowRequiresDistinctActorsAndPaymentEvidence() {
        Fixtures fixtures = new Fixtures();
        RequestPayoutUseCase request = fixtures.newRequestUseCase();
        Payout payout = request.request("seller-1", new BigDecimal("25.00"), "VND", "request-1");
        ProcessPayoutUseCase process = fixtures.newProcessUseCase();

        assertThatThrownBy(() -> process.approve(payout.payoutId().toString(), "seller-1", "approved"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("different");

        process.approve(payout.payoutId().toString(), "checker-1", "approved");
        process.beginSubmission(payout.payoutId().toString(), "payer-1");
        process.markSubmitted(payout.payoutId().toString(), "submitter-1", "provider-1", "attempt-1");

        assertThatThrownBy(() -> process.markPaid(
                payout.payoutId().toString(), "checker-1", "external-1", "", true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("evidence");

        Payout paid = process.markPaid(
                payout.payoutId().toString(), "payer-1", "external-1", "evidence-1", true);
        assertThat(paid.status()).isEqualTo(PayoutStatus.PAID);
        assertThat(paid.approvedBy()).isEqualTo("checker-1");
        assertThat(paid.paidBy()).isEqualTo("payer-1");
        assertThat(fixtures.ledger.journals).extracting(LedgerJournal::operationType)
                .containsExactlyInAnyOrder("PAYOUT_RESERVATION", "PAYOUT_COMPLETION");
    }

    @Test
    void rejectionReversesReservationExactlyOnce() {
        Fixtures fixtures = new Fixtures();
        Payout payout = fixtures.newRequestUseCase()
                .request("seller-1", new BigDecimal("25.00"), "VND", "request-1");
        ProcessPayoutUseCase process = fixtures.newProcessUseCase();

        Payout rejected = process.reject(payout.payoutId().toString(), "checker-1", "not eligible");
        Payout retry = process.reject(payout.payoutId().toString(), "checker-1", "not eligible");

        assertThat(rejected.status()).isEqualTo(PayoutStatus.REJECTED);
        assertThat(retry.status()).isEqualTo(PayoutStatus.REJECTED);
        assertThat(fixtures.wallet.availableBalance()).isEqualByComparingTo("100.00");
        assertThat(fixtures.wallet.payoutPendingBalance()).isEqualByComparingTo("0.00");
        assertThat(fixtures.ledger.journals).extracting(LedgerJournal::operationType)
                .containsExactlyInAnyOrder("PAYOUT_RESERVATION", "PAYOUT_REVERSAL");
    }

    @Test
    void unknownRecoveryUsesProviderQueryBeforeMarkingPaid() {
        Fixtures fixtures = new Fixtures();
        Payout payout = fixtures.newRequestUseCase()
                .request("seller-1", new BigDecimal("25.00"), "VND", "request-1");
        ProcessPayoutUseCase process = fixtures.newProcessUseCase(
                ignored -> PayoutProviderQueryPort.QueryResult.paid("external-1", "query-evidence"));

        process.approve(payout.payoutId().toString(), "checker-1", "approved");
        process.beginSubmission(payout.payoutId().toString(), "submitter-1");
        process.markUnknown(payout.payoutId().toString(), "submitter-1", "timeout");

        Payout recovered = process.recoverUnknown(payout.payoutId().toString(), "recovery-1");

        assertThat(recovered.status()).isEqualTo(PayoutStatus.PAID);
        assertThat(recovered.externalReference()).isEqualTo("external-1");
        assertThat(fixtures.queryCalls).isEqualTo(1);
    }

    @Test
    void providerSubmissionUsesStableKeyAndMapsAmbiguousResponseToUnknown() {
        Fixtures fixtures = new Fixtures();
        Payout payout = fixtures.newRequestUseCase()
                .request("seller-1", new BigDecimal("25.00"), "VND", "request-1");
        List<String> keys = new ArrayList<>();
        ProcessPayoutUseCase process = fixtures.newProviderProcessUseCase((submitted, key) -> {
            keys.add(key);
            return PayoutProviderPort.SubmissionResult.unknown("timeout after provider handoff");
        });

        process.approve(payout.payoutId().toString(), "checker-1", "approved");
        Payout unknown = process.submitToProvider(payout.payoutId().toString(), "submitter-1");

        assertThat(unknown.status()).isEqualTo(PayoutStatus.UNKNOWN);
        assertThat(keys).containsExactly("vnshop-payout-" + payout.payoutId());
        assertThat(unknown.failureReason()).isEqualTo("timeout after provider handoff");
    }

    @Test
    void providerSubmissionExceptionPersistsUnknownStateForRecovery() {
        Fixtures fixtures = new Fixtures();
        Payout payout = fixtures.newRequestUseCase()
                .request("seller-1", new BigDecimal("25.00"), "VND", "request-1");
        ProcessPayoutUseCase process = fixtures.newProviderProcessUseCase((submitted, key) -> {
            throw new IllegalStateException("provider timed out after accepting the request");
        });

        process.approve(payout.payoutId().toString(), "checker-1", "approved");

        Payout unknown = process.submitToProvider(payout.payoutId().toString(), "submitter-1");

        assertThat(unknown.status()).isEqualTo(PayoutStatus.UNKNOWN);
        assertThat(unknown.failureReason()).contains("provider timed out");
    }

    @Test
    void disabledExecutionModeRejectsLegacyMutationPaths() {
        Fixtures fixtures = new Fixtures();
        Payout payout = fixtures.newRequestUseCase()
                .request("seller-1", new BigDecimal("25.00"), "VND", "request-1");
        ProcessPayoutUseCase process = fixtures.newDisabledProcessUseCase();

        assertThatThrownBy(() -> process.reject(payout.payoutId().toString(), "checker-1", "not eligible"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("disabled");
    }

    private static final class Fixtures {
        private final InMemoryWalletRepository wallets = new InMemoryWalletRepository();
        private final InMemoryPayoutRepository payouts = new InMemoryPayoutRepository();
        private final InMemoryLedgerRepository ledger = new InMemoryLedgerRepository();
        private int queryCalls;
        private SellerWallet wallet;

        private Fixtures() {
            wallet = new SellerWallet(
                    "seller-1", "VND", new BigDecimal("100.00"), BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    new BigDecimal("100.00"), null, 0);
            wallets.values.put("seller-1", wallet);
        }

        private RequestPayoutUseCase newRequestUseCase() {
            CapturePayoutDestinationSnapshotUseCase capture =
                    new CapturePayoutDestinationSnapshotUseCase(id -> Optional.of(
                            new com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationMaterial(
                                    "destination-1", id, "v1.ciphertext", 1, "AES-256-GCM", "fingerprint-1")));
            SealPayoutDestinationSnapshotUseCase seal = new SealPayoutDestinationSnapshotUseCase(
                    new com.vnshop.sellerfinanceservice.domain.payoutdestination.SnapshotSealer() {
                        @Override
                        public String seal(String canonical) {
                            return "k1.envelope";
                        }

                        @Override
                        public void verify(String canonical, String envelope) {
                        }

                        @Override
                        public int currentKeyVersion() {
                            return 1;
                        }
                    });
            return new RequestPayoutUseCase(wallets, payouts, ledger,
                    sellerId -> new PayoutEligibilityPort.Eligibility(
                            PayoutEligibilityPort.Outcome.ELIGIBLE, sellerId, wallet.availableBalance(), List.of()),
                    capture, seal, CLOCK);
        }

        private ProcessPayoutUseCase newProcessUseCase() {
            return newProcessUseCase(ignored -> {
                throw new IllegalStateException("query not expected");
            });
        }

        private ProcessPayoutUseCase newProcessUseCase(PayoutProviderQueryPort providerQueryPort) {
            PayoutProviderQueryPort countingQuery = payout -> {
                queryCalls++;
                return providerQueryPort.query(payout);
            };
            return new ProcessPayoutUseCase(wallets, payouts, ledger, countingQuery, CLOCK);
        }

        private ProcessPayoutUseCase newProviderProcessUseCase(PayoutProviderPort provider) {
            return new ProcessPayoutUseCase(wallets, payouts, ledger,
                    ignored -> PayoutProviderQueryPort.QueryResult.unknown("query not expected"),
                    provider, CLOCK, com.vnshop.sellerfinanceservice.domain.PayoutExecutionMode.PROVIDER,
                    "vnshop-payout-", null);
        }

        private ProcessPayoutUseCase newDisabledProcessUseCase() {
            return new ProcessPayoutUseCase(wallets, payouts, ledger,
                    ignored -> PayoutProviderQueryPort.QueryResult.unknown("query not expected"),
                    (ignored, key) -> PayoutProviderPort.SubmissionResult.unknown("not expected"),
                    CLOCK, com.vnshop.sellerfinanceservice.domain.PayoutExecutionMode.DISABLED);
        }
    }

    private static final class InMemoryWalletRepository implements SellerWalletRepositoryPort {
        private final Map<String, SellerWallet> values = new HashMap<>();
        private int lockedLookups;

        @Override
        public Optional<SellerWallet> findBySellerId(String sellerId) {
            return Optional.ofNullable(values.get(sellerId));
        }

        @Override
        public Optional<SellerWallet> findBySellerIdForUpdate(String sellerId) {
            lockedLookups++;
            return Optional.ofNullable(values.get(sellerId));
        }

        @Override
        public SellerWallet save(SellerWallet wallet) {
            values.put(wallet.sellerId(), wallet);
            return wallet;
        }
    }

    private static final class InMemoryPayoutRepository implements PayoutRepositoryPort {
        private final Map<UUID, Payout> values = new HashMap<>();

        @Override
        public Payout save(Payout payout) {
            values.put(payout.payoutId(), payout);
            return payout;
        }

        @Override
        public Optional<Payout> findById(UUID payoutId) {
            return Optional.ofNullable(values.get(payoutId));
        }

        @Override
        public List<Payout> findByStatus(PayoutStatus status) {
            return values.values().stream().filter(payout -> payout.status() == status).toList();
        }

        @Override
        public List<Payout> findAdminCursor(String query, PayoutStatus status, Instant beforeCreatedAt,
                UUID beforePayoutId, int limit) {
            return values.values().stream()
                    .filter(payout -> status == null || payout.status() == status)
                    .filter(payout -> query == null || query.isBlank()
                            || payout.sellerId().toLowerCase().contains(query.trim().toLowerCase())
                            || payout.payoutId().toString().contains(query.trim().toLowerCase()))
                    .filter(payout -> beforeCreatedAt == null
                            || payout.createdAt().isBefore(beforeCreatedAt)
                            || (payout.createdAt().equals(beforeCreatedAt)
                                    && payout.payoutId().compareTo(beforePayoutId) < 0))
                    .sorted(Comparator.comparing(Payout::createdAt).reversed()
                            .thenComparing(Payout::payoutId, Comparator.reverseOrder()))
                    .limit(limit)
                    .toList();
        }

        @Override
        public List<Payout> findCompleted() {
            return findByStatus(PayoutStatus.COMPLETED);
        }

        @Override
        public List<Payout> findBySellerId(String sellerId) {
            return values.values().stream().filter(payout -> payout.sellerId().equals(sellerId)).toList();
        }
    }

    private static final class InMemoryLedgerRepository implements LedgerRepositoryPort {
        private final List<LedgerJournal> journals = new ArrayList<>();

        @Override
        public Optional<LedgerJournal> findBySourceOperation(String sourceType, UUID sourceId, String operationType) {
            return journals.stream().filter(journal -> journal.hasSourceOperation(sourceType, sourceId, operationType)).findFirst();
        }

        @Override
        public LedgerJournal save(LedgerJournal journal) {
            journals.add(journal);
            return journal;
        }
    }
}
