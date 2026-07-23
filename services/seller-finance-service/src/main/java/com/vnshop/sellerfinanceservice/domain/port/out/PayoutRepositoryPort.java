package com.vnshop.sellerfinanceservice.domain.port.out;

import com.vnshop.sellerfinanceservice.domain.Payout;
import com.vnshop.sellerfinanceservice.domain.PayoutStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PayoutRepositoryPort {
    Payout save(Payout payout);

    Optional<Payout> findById(UUID payoutId);

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
