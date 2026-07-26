package com.vnshop.sellerfinanceservice.application;

import com.vnshop.sellerfinanceservice.domain.LedgerAccountCode;
import com.vnshop.sellerfinanceservice.domain.LedgerDirection;
import com.vnshop.sellerfinanceservice.domain.LedgerJournal;
import com.vnshop.sellerfinanceservice.domain.LedgerJournalType;
import com.vnshop.sellerfinanceservice.domain.LedgerPosting;
import com.vnshop.sellerfinanceservice.domain.Payout;
import com.vnshop.sellerfinanceservice.domain.PayoutExecutionMode;
import com.vnshop.sellerfinanceservice.domain.PayoutStatus;
import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutProviderQueryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutProviderPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

public class ProcessPayoutUseCase {
    private final SellerWalletRepositoryPort walletRepository;
    private final PayoutRepositoryPort payoutRepository;
    private final LedgerRepositoryPort ledgerRepository;
    private final PayoutProviderQueryPort providerQuery;
    private final PayoutProviderPort provider;
    private final Clock clock;
    private final PayoutExecutionMode executionMode;
    private final String providerIdempotencyPrefix;
    private final TransactionTemplate transactionTemplate;

    /** Compatibility constructor for legacy manual completion/failure routes. */
    public ProcessPayoutUseCase(SellerWalletRepositoryPort walletRepository, PayoutRepositoryPort payoutRepository) {
        this(walletRepository, payoutRepository, null,
                payout -> PayoutProviderQueryPort.QueryResult.unknown("provider query unavailable"),
                (payout, providerIdempotencyKey) -> {
                    throw new IllegalStateException("provider adapter is not configured");
                },
                Clock.systemUTC(), PayoutExecutionMode.MANUAL_RECORDED, null, null);
    }

    public ProcessPayoutUseCase(SellerWalletRepositoryPort walletRepository, PayoutRepositoryPort payoutRepository,
                                LedgerRepositoryPort ledgerRepository, PayoutProviderQueryPort providerQuery,
                                Clock clock) {
        this(walletRepository, payoutRepository, ledgerRepository, providerQuery,
                (payout, providerIdempotencyKey) -> {
                    throw new IllegalStateException("provider adapter is not configured");
                }, clock, PayoutExecutionMode.MANUAL_RECORDED, null, null);
    }

    public ProcessPayoutUseCase(SellerWalletRepositoryPort walletRepository, PayoutRepositoryPort payoutRepository,
                                LedgerRepositoryPort ledgerRepository, PayoutProviderQueryPort providerQuery,
                                Clock clock, PayoutExecutionMode executionMode) {
        this(walletRepository, payoutRepository, ledgerRepository, providerQuery,
                (payout, providerIdempotencyKey) -> {
                    throw new IllegalStateException("provider adapter is not configured");
                }, clock, executionMode, null, null);
    }

    public ProcessPayoutUseCase(SellerWalletRepositoryPort walletRepository, PayoutRepositoryPort payoutRepository,
                                LedgerRepositoryPort ledgerRepository, PayoutProviderQueryPort providerQuery,
                                PayoutProviderPort provider, Clock clock, PayoutExecutionMode executionMode) {
        this(walletRepository, payoutRepository, ledgerRepository, providerQuery, provider, clock, executionMode,
                null, null);
    }

    public ProcessPayoutUseCase(SellerWalletRepositoryPort walletRepository, PayoutRepositoryPort payoutRepository,
                                LedgerRepositoryPort ledgerRepository, PayoutProviderQueryPort providerQuery,
                                PayoutProviderPort provider, Clock clock, PayoutExecutionMode executionMode,
                                TransactionTemplate transactionTemplate) {
        this(walletRepository, payoutRepository, ledgerRepository, providerQuery, provider, clock, executionMode,
                null, transactionTemplate);
    }

    public ProcessPayoutUseCase(SellerWalletRepositoryPort walletRepository, PayoutRepositoryPort payoutRepository,
                                LedgerRepositoryPort ledgerRepository, PayoutProviderQueryPort providerQuery,
                                PayoutProviderPort provider, Clock clock, PayoutExecutionMode executionMode,
                                String providerIdempotencyPrefix, TransactionTemplate transactionTemplate) {
        this.walletRepository = Objects.requireNonNull(walletRepository, "walletRepository is required");
        this.payoutRepository = Objects.requireNonNull(payoutRepository, "payoutRepository is required");
        this.ledgerRepository = ledgerRepository;
        this.providerQuery = Objects.requireNonNull(providerQuery, "providerQuery is required");
        this.provider = Objects.requireNonNull(provider, "provider is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
        this.executionMode = Objects.requireNonNull(executionMode, "executionMode is required");
        this.providerIdempotencyPrefix = providerIdempotencyPrefix;
        this.transactionTemplate = transactionTemplate;
    }

    @Transactional
    public Payout approve(String payoutId, String actor, String reason) {
        requireExecutionEnabled();
        Payout payout = findPayout(payoutId);
        payout.approve(actor, reason, clock.instant());
        return payoutRepository.save(payout);
    }

    @Transactional
    public Payout beginSubmission(String payoutId, String actor) {
        requireExecutionEnabled();
        Payout payout = findPayout(payoutId);
        payout.beginSubmission(actor, clock.instant());
        return payoutRepository.save(payout);
    }

    @Transactional
    public Payout markSubmitted(String payoutId, String actor, String providerReference, String attemptId) {
        requireExecutionEnabled();
        Payout payout = findPayout(payoutId);
        payout.markSubmitted(actor, providerReference, attemptId, clock.instant());
        return payoutRepository.save(payout);
    }

    /** Submits once using the payout id as the provider idempotency key. */
    public Payout submitToProvider(String payoutId, String actor) {
        requireExecutionEnabled();
        if (executionMode != PayoutExecutionMode.PROVIDER) {
            throw new IllegalStateException("provider payout execution is disabled");
        }
        Payout payout = inTransaction(() -> {
            Payout current = findPayout(payoutId);
            if (current.status() == PayoutStatus.SUBMITTED || current.status() == PayoutStatus.UNKNOWN
                    || current.status() == PayoutStatus.PAID || current.status() == PayoutStatus.FAILED) {
                return current;
            }
            current.beginSubmission(actor, clock.instant());
            return payoutRepository.save(current);
        });
        if (payout.status() == PayoutStatus.SUBMITTED || payout.status() == PayoutStatus.UNKNOWN
                || payout.status() == PayoutStatus.PAID || payout.status() == PayoutStatus.FAILED) {
            return payout;
        }

        String providerIdempotencyKey = required(providerIdempotencyPrefix, "provider idempotency prefix")
                + payout.payoutId();
        try {
            PayoutProviderPort.SubmissionResult result = provider.submit(payout, providerIdempotencyKey);
            return inTransaction(() -> switch (result.outcome()) {
                case SUBMITTED -> markSubmitted(payoutId, actor,
                        required(result.externalReference(), "provider reference"), providerIdempotencyKey);
                case UNKNOWN -> markUnknown(payoutId, actor,
                        required(result.evidence(), "provider uncertainty evidence"));
                case FAILED -> failCanonical(findPayout(payoutId), actor,
                        required(result.evidence(), "provider failure evidence"));
            });
        } catch (RuntimeException exception) {
            return inTransaction(() -> {
                Payout current = findPayout(payoutId);
                if (current.status() == PayoutStatus.UNKNOWN || current.status() == PayoutStatus.PAID
                        || current.status() == PayoutStatus.FAILED) {
                    return current;
                }
                current.markUnknown(actor, providerFailureReason(exception), clock.instant());
                return payoutRepository.save(current);
            });
        }
    }

    @Transactional
    public Payout markUnknown(String payoutId, String actor, String reason) {
        requireExecutionEnabled();
        Payout payout = findPayout(payoutId);
        payout.markUnknown(actor, reason, clock.instant());
        return payoutRepository.save(payout);
    }

    @Transactional
    public Payout markPaid(String payoutId, String actor, String providerReference, String evidence,
                           boolean evidenceVerified) {
        requireExecutionEnabled();
        Payout payout = findPayout(payoutId);
        if (payout.status() == PayoutStatus.PAID) return payout;
        payout.markPaid(actor, providerReference, evidence, evidenceVerified, clock.instant());
        SellerWallet wallet = lockedWallet(payout);
        wallet.completePayout(payout.amount(), clock.instant());
        appendCompletionJournal(payout);
        walletRepository.save(wallet);
        return payoutRepository.save(payout);
    }

    @Transactional
    public Payout reject(String payoutId, String actor, String reason) {
        requireExecutionEnabled();
        Payout payout = findPayout(payoutId);
        if (payout.status() == PayoutStatus.REJECTED) return payout;
        payout.reject(actor, reason, clock.instant());
        SellerWallet wallet = lockedWallet(payout);
        wallet.reversePayoutReservation(payout.amount());
        appendReversalJournal(payout);
        walletRepository.save(wallet);
        return payoutRepository.save(payout);
    }

    @Transactional
    public Payout recoverUnknown(String payoutId, String actor) {
        requireExecutionEnabled();
        Payout payout = findPayout(payoutId);
        if (payout.status() != PayoutStatus.UNKNOWN) {
            if (payout.status() == PayoutStatus.PAID || payout.status() == PayoutStatus.FAILED) return payout;
            throw new IllegalStateException("payout is not unknown");
        }
        PayoutProviderQueryPort.QueryResult result = providerQuery.query(payout);
        return switch (result.outcome()) {
            case PAID -> markPaid(payoutId, actor, result.externalReference(), result.evidence(), true);
            case FAILED -> failCanonical(payout, actor, result.evidence());
            case UNKNOWN -> payoutRepository.save(payout);
        };
    }

    /** Legacy admin route: completes a pre-V10 PENDING payout. */
    @Transactional
    public Payout complete(String payoutId, String completedBy) {
        requireExecutionEnabled();
        Payout payout = findPayout(payoutId);
        if (payout.status() == PayoutStatus.COMPLETED || payout.status() == PayoutStatus.PAID) return payout;
        if (payout.status() != PayoutStatus.PENDING) throw new IllegalStateException("payout is not pending");
        SellerWallet wallet = legacyWallet(payout);
        Instant now = clock.instant();
        wallet.completePayout(payout.amount(), now);
        payout.complete(completedBy, now);
        walletRepository.save(wallet);
        return payoutRepository.save(payout);
    }

    @Transactional
    public Payout complete(String payoutId, String completedBy, String reason, String evidence) {
        requireExecutionEnabled();
        Payout payout = findPayout(payoutId);
        if (payout.status() == PayoutStatus.COMPLETED || payout.status() == PayoutStatus.PAID) return payout;
        if (payout.status() != PayoutStatus.PENDING) throw new IllegalStateException("payout is not pending");
        SellerWallet wallet = legacyWallet(payout);
        Instant now = clock.instant();
        payout.complete(completedBy, now, reason, evidence);
        wallet.completePayout(payout.amount(), now);
        walletRepository.save(wallet);
        return payoutRepository.save(payout);
    }

    /** Legacy admin route: returns the reservation to available funds. */
    @Transactional
    public Payout fail(String payoutId) {
        requireExecutionEnabled();
        Payout payout = findPayout(payoutId);
        if (payout.status() == PayoutStatus.FAILED || payout.status() == PayoutStatus.REJECTED) return payout;
        if (payout.status() != PayoutStatus.PENDING) throw new IllegalStateException("payout is not pending");
        SellerWallet wallet = legacyWallet(payout);
        wallet.failPayout(payout.amount());
        payout.fail();
        walletRepository.save(wallet);
        return payoutRepository.save(payout);
    }

    @Transactional
    public Payout fail(String payoutId, String actor, String reason, String evidence) {
        requireExecutionEnabled();
        Payout payout = findPayout(payoutId);
        if (payout.status() == PayoutStatus.FAILED) return payout;
        if (payout.status() != PayoutStatus.PENDING) throw new IllegalStateException("payout is not pending");
        SellerWallet wallet = legacyWallet(payout);
        payout.fail(actor, reason, evidence, clock.instant());
        wallet.failPayout(payout.amount());
        walletRepository.save(wallet);
        return payoutRepository.save(payout);
    }

    public List<Payout> pending() { return pending(null); }

    public List<Payout> pending(String query) {
        List<Payout> result = new ArrayList<>();
        for (PayoutStatus status : List.of(PayoutStatus.REQUESTED, PayoutStatus.APPROVED,
                PayoutStatus.SUBMITTING, PayoutStatus.SUBMITTED, PayoutStatus.UNKNOWN, PayoutStatus.PENDING)) {
            result.addAll(query == null || query.isBlank()
                    ? payoutRepository.findByStatus(status)
                    : payoutRepository.findByStatus(status, query));
        }
        return result.stream().distinct().toList();
    }

    public List<Payout> completed() { return completed(null); }

    public List<Payout> completed(String query) {
        List<Payout> result = new ArrayList<>(query == null || query.isBlank()
                ? payoutRepository.findCompleted()
                : payoutRepository.findCompleted(query));
        result.addAll(query == null || query.isBlank()
                ? payoutRepository.findByStatus(PayoutStatus.PAID)
                : payoutRepository.findByStatus(PayoutStatus.PAID, query));
        return result.stream().distinct().toList();
    }

    private Payout failCanonical(Payout payout, String actor, String evidence) {
        payout.fail(actor, evidence == null || evidence.isBlank() ? "provider reported failure" : evidence, clock.instant());
        SellerWallet wallet = lockedWallet(payout);
        wallet.failPayout(payout.amount());
        appendReversalJournal(payout);
        walletRepository.save(wallet);
        return payoutRepository.save(payout);
    }

    private SellerWallet lockedWallet(Payout payout) {
        return walletRepository.findBySellerIdForUpdate(payout.sellerId())
                .orElseThrow(() -> new IllegalArgumentException("wallet not found"));
    }

    private SellerWallet legacyWallet(Payout payout) {
        return walletRepository.findBySellerId(payout.sellerId())
                .orElseThrow(() -> new IllegalArgumentException("wallet not found"));
    }

    private void appendCompletionJournal(Payout payout) {
        if (ledgerRepository == null) return;
        var existing = ledgerRepository.findBySourceOperation("PAYOUT", payout.payoutId(), "PAYOUT_COMPLETION");
        if (existing != null && existing.isPresent()) return;
        ledgerRepository.save(new LedgerJournal(UUID.randomUUID(), payout.sellerId(), "PAYOUT", payout.payoutId(),
                "PAYOUT_COMPLETION", LedgerJournalType.PAYOUT_COMPLETION, clock.instant(), null,
                List.of(posting(LedgerAccountCode.SELLER_PAYOUT_PENDING, LedgerDirection.DEBIT, payout.amount(), payout.currency()),
                        posting(LedgerAccountCode.SELLER_PAID_OUT, LedgerDirection.CREDIT, payout.amount(), payout.currency()))));
    }

    private void appendReversalJournal(Payout payout) {
        if (ledgerRepository == null) return;
        var existing = ledgerRepository.findBySourceOperation("PAYOUT", payout.payoutId(), "PAYOUT_REVERSAL");
        if (existing != null && existing.isPresent()) return;
        var original = ledgerRepository.findBySourceOperation("PAYOUT", payout.payoutId(), "PAYOUT_RESERVATION");
        UUID originalId = original == null ? null : original.map(LedgerJournal::journalId).orElse(null);
        ledgerRepository.save(new LedgerJournal(UUID.randomUUID(), payout.sellerId(), "PAYOUT", payout.payoutId(),
                "PAYOUT_REVERSAL", LedgerJournalType.PAYOUT_REVERSAL, clock.instant(), originalId,
                List.of(posting(LedgerAccountCode.SELLER_PAYOUT_PENDING, LedgerDirection.DEBIT, payout.amount(), payout.currency()),
                        posting(LedgerAccountCode.SELLER_AVAILABLE, LedgerDirection.CREDIT, payout.amount(), payout.currency()))));
    }

    private static LedgerPosting posting(LedgerAccountCode account, LedgerDirection direction,
                                         BigDecimal amount, String currency) {
        return new LedgerPosting(account, direction, amount, currency);
    }

    private Payout findPayout(String payoutId) {
        if (payoutId == null || payoutId.isBlank()) throw new IllegalArgumentException("payoutId is required");
        return payoutRepository.findById(UUID.fromString(payoutId))
                .orElseThrow(() -> new IllegalArgumentException("payout not found"));
    }

    private void requireExecutionEnabled() {
        if (executionMode == PayoutExecutionMode.DISABLED) {
            throw new IllegalStateException("payout execution is disabled");
        }
    }

    private static String required(String value, String fieldName) {
        if (value == null || value.isBlank()) throw new IllegalStateException(fieldName + " is required");
        return value;
    }

    private <T> T inTransaction(java.util.function.Supplier<T> action) {
        if (transactionTemplate == null) return action.get();
        return transactionTemplate.execute(status -> action.get());
    }

    private static String providerFailureReason(RuntimeException exception) {
        String detail = exception.getMessage();
        return detail == null || detail.isBlank()
                ? "provider submission outcome unknown"
                : "provider submission outcome unknown: " + detail;
    }
}
