package com.vnshop.sellerfinanceservice.domain.port.out;

import com.vnshop.sellerfinanceservice.domain.Payout;
import com.vnshop.sellerfinanceservice.domain.PayoutStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PayoutRepositoryPort {
    Payout save(Payout payout);

    Optional<Payout> findById(UUID payoutId);

    default Optional<Payout> findBySellerIdAndIdempotencyKey(String sellerId, String idempotencyKey) {
        if (sellerId == null || idempotencyKey == null) return Optional.empty();
        return findBySellerId(sellerId).stream()
                .filter(payout -> idempotencyKey.equals(payout.idempotencyKey()))
                .findFirst();
    }

    List<Payout> findByStatus(PayoutStatus status);

    default List<Payout> findByStatus(PayoutStatus status, String query) {
        return findByStatus(status);
    }

    List<Payout> findCompleted();

    default List<Payout> findCompleted(String query) {
        return findCompleted();
    }

    List<Payout> findBySellerId(String sellerId);
}
