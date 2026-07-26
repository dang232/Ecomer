package com.vnshop.sellerfinanceservice.application;

import com.vnshop.sellerfinanceservice.domain.LedgerAccountCode;
import com.vnshop.sellerfinanceservice.domain.LedgerDirection;
import com.vnshop.sellerfinanceservice.domain.LedgerJournal;
import com.vnshop.sellerfinanceservice.domain.LedgerJournalType;
import com.vnshop.sellerfinanceservice.domain.LedgerPosting;
import com.vnshop.sellerfinanceservice.domain.Payout;
import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationSnapshot;
import com.vnshop.sellerfinanceservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutDestinationClient;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutEligibilityPort;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

public class RequestPayoutUseCase {
    private final SellerWalletRepositoryPort walletRepository;
    private final PayoutRepositoryPort payoutRepository;
    private final LedgerRepositoryPort ledgerRepository;
    private final PayoutEligibilityPort eligibilityPort;
    private final CapturePayoutDestinationSnapshotUseCase captureDestination;
    private final SealPayoutDestinationSnapshotUseCase sealDestination;
    private final Clock clock;

    /** Compatibility constructor for the pre-V10 payout endpoint. */
    public RequestPayoutUseCase(SellerWalletRepositoryPort walletRepository, PayoutRepositoryPort payoutRepository) {
        this(walletRepository, payoutRepository, null, null, null, null, Clock.systemUTC());
    }

    public RequestPayoutUseCase(
            SellerWalletRepositoryPort walletRepository,
            PayoutRepositoryPort payoutRepository,
            LedgerRepositoryPort ledgerRepository,
            PayoutEligibilityPort eligibilityPort,
            CapturePayoutDestinationSnapshotUseCase captureDestination,
            SealPayoutDestinationSnapshotUseCase sealDestination,
            Clock clock) {
        this.walletRepository = Objects.requireNonNull(walletRepository, "walletRepository is required");
        this.payoutRepository = Objects.requireNonNull(payoutRepository, "payoutRepository is required");
        this.ledgerRepository = ledgerRepository;
        this.eligibilityPort = eligibilityPort;
        this.captureDestination = captureDestination;
        this.sealDestination = sealDestination;
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    @Transactional
    public Payout request(String sellerId, BigDecimal amount) {
        requireNonBlank(sellerId, "sellerId");
        SellerWallet wallet = walletRepository.findBySellerId(sellerId)
                .orElseThrow(() -> new IllegalArgumentException("wallet not found"));
        wallet.reservePayout(amount);
        walletRepository.save(wallet);
        return payoutRepository.save(Payout.pending(sellerId, amount, clock.instant()));
    }

    /** Reserves funds, captures the destination, and writes one idempotent journal. */
    @Transactional
    public Payout request(String sellerId, BigDecimal amount, String currency, String idempotencyKey) {
        requireNonBlank(sellerId, "sellerId");
        requireNonBlank(currency, "currency");
        requireNonBlank(idempotencyKey, "idempotencyKey");
        Objects.requireNonNull(amount, "amount is required");

        // Lock the wallet before checking the idempotency record so concurrent retries
        // serialize with the reservation transaction rather than racing the unique key.
        SellerWallet wallet = walletRepository.findBySellerIdForUpdate(sellerId)
                .orElseThrow(() -> new IllegalArgumentException("wallet not found"));
        Optional<Payout> existing = payoutRepository.findBySellerIdAndIdempotencyKey(sellerId, idempotencyKey);
        if (existing.isPresent()) {
            Payout payout = existing.get();
            if (payout.amount().compareTo(amount) != 0 || !currency.equalsIgnoreCase(payout.currency())) {
                throw new IllegalStateException("idempotency key was already used with different terms");
            }
            return payout;
        }
        if (ledgerRepository == null || eligibilityPort == null || captureDestination == null || sealDestination == null) {
            throw new IllegalStateException("canonical payout dependencies are not configured");
        }

        if (!currency.equalsIgnoreCase(wallet.currency())) {
            throw new IllegalArgumentException("payout currency does not match wallet currency");
        }
        PayoutEligibilityPort.Eligibility eligibility = eligibilityPort.check(sellerId, amount);
        if (!eligibility.isEligible()) {
            throw new IllegalStateException("payout is not eligible: "
                    + eligibility.blockingReasons().stream().map(reason -> reason.code().name()).toList());
        }

        PayoutDestinationSnapshot snapshot = captureDestination.captureOrNull(sellerId, "", "****");
        snapshot = sealDestination.seal(snapshot);
        wallet.reservePayout(amount);
        Payout payout = Payout.requested(sellerId, amount, currency.toUpperCase(), idempotencyKey, snapshot, clock.instant());
        LedgerJournal journal = new LedgerJournal(
                UUID.randomUUID(), sellerId, "PAYOUT", payout.payoutId(), "PAYOUT_RESERVATION",
                LedgerJournalType.PAYOUT_RESERVATION, clock.instant(), null,
                List.of(
                        posting(LedgerAccountCode.SELLER_AVAILABLE, LedgerDirection.DEBIT, amount, currency),
                        posting(LedgerAccountCode.SELLER_PAYOUT_PENDING, LedgerDirection.CREDIT, amount, currency)));
        ledgerRepository.save(journal);
        walletRepository.save(wallet);
        return payoutRepository.save(payout);
    }

    private static LedgerPosting posting(LedgerAccountCode account, LedgerDirection direction,
                                         BigDecimal amount, String currency) {
        return new LedgerPosting(account, direction, amount, currency.toUpperCase());
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(fieldName + " is required");
    }
}
