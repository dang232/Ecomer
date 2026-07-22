package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.RefundLedgerEntry;
import com.vnshop.orderservice.domain.port.out.RefundLedgerRepositoryPort;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import com.vnshop.orderservice.domain.RefundByDate;
import org.springframework.stereotype.Repository;

@Repository
public class RefundLedgerJpaRepository implements RefundLedgerRepositoryPort {
    private final RefundLedgerSpringDataRepository springDataRepository;

    public RefundLedgerJpaRepository(RefundLedgerSpringDataRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public boolean existsByRefundId(String refundId) {
        return springDataRepository.existsById(refundId);
    }

    @Override
    public RefundLedgerEntry save(RefundLedgerEntry entry) {
        return springDataRepository.save(RefundLedgerJpaEntity.fromDomain(entry)).toDomain();
    }

    @Override
    public BigDecimal sumByOrderCreatedAtBetween(Instant startInclusive, Instant endInclusive) {
        return sumByOrderCreatedAtBetweenAndRefundedAtAtMost(startInclusive, endInclusive, Instant.now());
    }

    @Override
    public BigDecimal sumByOrderCreatedAtBetweenAndRefundedAtAtMost(
            Instant startInclusive,
            Instant endInclusive,
            Instant asOf) {
        return springDataRepository.sumByOrderCreatedAtBetweenAndRefundedAtAtMost(
                startInclusive, endInclusive, asOf);
    }

    @Override
    public List<RefundByDate> sumByOrderCreatedDateBetweenAndRefundedAtAtMost(
            LocalDate startDate,
            LocalDate endDate,
            Instant asOf) {
        return springDataRepository.sumByOrderCreatedDateBetweenAndRefundedAtAtMost(
                startDate.atStartOfDay().toInstant(ZoneOffset.UTC),
                endDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC).minusNanos(1),
                asOf);
    }
}
