package com.vnshop.sellerfinanceservice.application;

import com.vnshop.sellerfinanceservice.domain.Payout;
import com.vnshop.sellerfinanceservice.domain.PayoutStatus;
import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public class ProcessPayoutUseCase {
    private final SellerWalletRepositoryPort walletRepository;
    private final PayoutRepositoryPort payoutRepository;

    public ProcessPayoutUseCase(SellerWalletRepositoryPort walletRepository, PayoutRepositoryPort payoutRepository) {
        this.walletRepository = Objects.requireNonNull(walletRepository, "walletRepository is required");
        this.payoutRepository = Objects.requireNonNull(payoutRepository, "payoutRepository is required");
    }

    public Payout complete(String payoutId, String completedBy) {
        Payout payout = findPayout(payoutId);
        if (payout.status() != PayoutStatus.PENDING) {
            throw new IllegalStateException("payout is not pending");
        }
        SellerWallet wallet = walletRepository.findBySellerId(payout.sellerId()).orElseThrow(() -> new IllegalArgumentException("wallet not found"));
        Instant now = Instant.now();
        wallet.completePayout(payout.amount(), now);
        payout.complete(completedBy, now);
        walletRepository.save(wallet);
        return payoutRepository.save(payout);
    }

    public Payout fail(String payoutId) {
        Payout payout = findPayout(payoutId);
        if (payout.status() != PayoutStatus.PENDING) {
            throw new IllegalStateException("payout is not pending");
        }
        SellerWallet wallet = walletRepository.findBySellerId(payout.sellerId()).orElseThrow(() -> new IllegalArgumentException("wallet not found"));
        wallet.failPayout(payout.amount());
        payout.fail();
        walletRepository.save(wallet);
        return payoutRepository.save(payout);
    }

    public List<Payout> pending() {
        return pending(null);
    }

    public List<Payout> pending(String query) {
        return query == null || query.isBlank()
                ? payoutRepository.findByStatus(PayoutStatus.PENDING)
                : payoutRepository.findByStatus(PayoutStatus.PENDING, query);
    }

    public List<Payout> completed() {
        return completed(null);
    }

    public List<Payout> completed(String query) {
        return query == null || query.isBlank()
                ? payoutRepository.findCompleted()
                : payoutRepository.findCompleted(query);
    }

    private Payout findPayout(String payoutId) {
        if (payoutId == null || payoutId.isBlank()) {
            throw new IllegalArgumentException("payoutId is required");
        }
        return payoutRepository.findById(UUID.fromString(payoutId)).orElseThrow(() -> new IllegalArgumentException("payout not found"));
    }
}
