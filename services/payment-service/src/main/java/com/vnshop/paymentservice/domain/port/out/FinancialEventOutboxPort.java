package com.vnshop.paymentservice.domain.port.out;

import com.vnshop.paymentservice.domain.FinancialEventOutboxRecord;
import java.time.Instant;
import java.util.List;

public interface FinancialEventOutboxPort {
    FinancialEventOutboxRecord save(FinancialEventOutboxRecord record);

    List<FinancialEventOutboxRecord> findRetryable(int limit, Instant now);

    void markPublished(Long id, Instant publishedAt);

    void recordFailure(Long id, int attemptCount, String error, Instant nextAttemptAt, boolean dead);
}
