package com.vnshop.paymentservice.domain.port.out;

import com.vnshop.paymentservice.domain.PaymentIdempotencyKey;

import java.util.Optional;

public interface PaymentIdempotencyKeyRepositoryPort {
    Optional<PaymentIdempotencyKey> findByKey(String key);

    default void deleteByKey(String key) {
    }

    default boolean claim(PaymentIdempotencyKey key) {
        return false;
    }

    default boolean supportsAtomicClaim() {
        return false;
    }

    default void markCompleted(String key) {
    }

    default int deleteAbandonedClaims(java.time.Instant before) {
        return 0;
    }

    PaymentIdempotencyKey save(PaymentIdempotencyKey key);
}
