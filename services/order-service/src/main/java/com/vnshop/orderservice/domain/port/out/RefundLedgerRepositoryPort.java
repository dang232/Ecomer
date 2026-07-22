package com.vnshop.orderservice.domain.port.out;

import com.vnshop.orderservice.domain.RefundLedgerEntry;
import com.vnshop.orderservice.domain.RefundByDate;

import java.time.Instant;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface RefundLedgerRepositoryPort {
    boolean existsByRefundId(String refundId);

    RefundLedgerEntry save(RefundLedgerEntry entry);

    BigDecimal sumByOrderCreatedAtBetween(Instant startInclusive, Instant endInclusive);

    BigDecimal sumByOrderCreatedAtBetweenAndRefundedAtAtMost(
            Instant startInclusive,
            Instant endInclusive,
            Instant asOf);

    default List<RefundByDate> sumByOrderCreatedDateBetweenAndRefundedAtAtMost(
            LocalDate startDate,
            LocalDate endDate,
            Instant asOf) {
        return List.of();
    }
}
