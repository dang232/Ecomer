package com.vnshop.paymentservice.domain.port.out;

import com.vnshop.paymentservice.domain.PaymentCallbackOutboxRecord;

import java.time.Instant;
import java.util.List;

public interface PaymentCallbackOutbox {
    PaymentCallbackOutboxRecord save(PaymentCallbackOutboxRecord record);

    /**
     * Returns up to {@code limit} rows that have never been published, oldest first.
     * Drives the relay's batch-publish loop.
     */
    List<PaymentCallbackOutboxRecord> findUnpublished(int limit);

    /**
     * Returns up to {@code limit} rows eligible for (re-)delivery: not dead, not yet
     * published, and whose {@code next_attempt_at} is in the past (or null).
     */
    List<PaymentCallbackOutboxRecord> findRetryable(int limit);

    /**
     * Stamps {@code published_at = now()} on the row with the given id, idempotently
     * (no-op if already published or absent).
     */
    void markPublished(Long id);

    /**
     * Records a failed delivery attempt. Sets attempt_count, last_error, next_attempt_at
     * and the dead flag. Pass {@code nextAttemptAt = null} when {@code dead = true}.
     */
    void recordFailure(Long id, int attemptCount, String error, Instant nextAttemptAt, boolean dead);
}
