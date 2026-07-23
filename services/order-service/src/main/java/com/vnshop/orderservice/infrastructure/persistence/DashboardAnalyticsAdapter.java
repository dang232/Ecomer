package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.port.out.DashboardAnalyticsPort;
import com.vnshop.orderservice.domain.RefundByDate;
import com.vnshop.orderservice.domain.port.out.RefundLedgerRepositoryPort;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Repository
public class DashboardAnalyticsAdapter implements DashboardAnalyticsPort {

    private final OrderJpaRepository orderJpaRepository;
    private final RefundLedgerRepositoryPort refundLedgerRepository;

    public DashboardAnalyticsAdapter(
            OrderJpaRepository orderJpaRepository,
            RefundLedgerRepositoryPort refundLedgerRepository) {
        this.orderJpaRepository = orderJpaRepository;
        this.refundLedgerRepository = refundLedgerRepository;
    }

    @Override
    public long countByDateBetween(LocalDate startDate, LocalDate endDate) {
        return orderJpaRepository.countByDateBetween(startDate, endDate);
    }

    @Override
    public BigDecimal sumRevenueByDateBetween(LocalDate startDate, LocalDate endDate) {
        return orderJpaRepository.sumRevenueByDateBetween(startDate, endDate);
    }

    @Override
    public long countDistinctBuyerId(LocalDate startDate, LocalDate endDate) {
        return orderJpaRepository.countDistinctBuyerId(startDate, endDate);
    }

    @Override
    public long countDistinctSellerId(LocalDate startDate, LocalDate endDate) {
        return orderJpaRepository.countDistinctSellerId(startDate, endDate);
    }

    @Override
    public List<RevenueByDate> revenueByDateBetween(LocalDate startDate, LocalDate endDate) {
        return orderJpaRepository.revenueByDateBetween(startDate, endDate).stream()
                .map(r -> new RevenueByDate(r.date(), r.revenue()))
                .toList();
    }

    @Override
    public List<TopMetric> topProducts(int limit) {
        return orderJpaRepository.topProducts(limit).stream()
                .map(m -> new TopMetric(m.id(), m.name(), m.value()))
                .toList();
    }

    @Override
    public List<TopMetric> topSellers(int limit) {
        return orderJpaRepository.topSellers(limit).stream()
                .map(m -> new TopMetric(m.id(), m.name(), m.value()))
                .toList();
    }

    @Override
    public List<SellerRevenueByDate> sellerRevenueByDateBetween(String sellerId, LocalDate startDate, LocalDate endDate) {
        return orderJpaRepository.sellerRevenueByDateBetween(sellerId, startDate, endDate).stream()
                .map(r -> new SellerRevenueByDate(r.date(), r.revenue(), r.orderCount()))
                .toList();
    }

    @Override
    public long countPaidOrdersBetween(LocalDate startDate, LocalDate endDate) {
        return orderJpaRepository.countPaidOrdersBetween(startDate, endDate);
    }

    @Override
    public long countPaidOrdersBetween(LocalDate startDate, LocalDate endDate, Instant asOf) {
        return orderJpaRepository.countPaidOrdersBetween(startDate, endDate, asOf);
    }

    @Override
    public BigDecimal sumPaidGmvByDateBetween(LocalDate startDate, LocalDate endDate) {
        return orderJpaRepository.sumPaidGmvByDateBetween(startDate, endDate);
    }

    @Override
    public BigDecimal sumPaidGmvByDateBetween(LocalDate startDate, LocalDate endDate, Instant asOf) {
        return orderJpaRepository.sumPaidGmvByDateBetween(startDate, endDate, asOf);
    }

    @Override
    public BigDecimal sumRefundedAmountBetween(LocalDate startDate, LocalDate endDate, Instant asOf) {
        return refundLedgerRepository.sumByOrderCreatedAtBetweenAndRefundedAtAtMost(
                startDate.atStartOfDay(java.time.ZoneOffset.UTC).toInstant(),
                endDate.plusDays(1).atStartOfDay(java.time.ZoneOffset.UTC).toInstant().minusNanos(1),
                asOf);
    }

    @Override
    public List<RefundByDate> refundedAmountByDateBetween(
            LocalDate startDate, LocalDate endDate, Instant asOf) {
        return refundLedgerRepository.sumByOrderCreatedDateBetweenAndRefundedAtAtMost(startDate, endDate, asOf);
    }

    @Override
    public long countDistinctPaidBuyerId(LocalDate startDate, LocalDate endDate) {
        return orderJpaRepository.countDistinctPaidBuyerId(startDate, endDate);
    }

    @Override
    public long countDistinctPaidBuyerId(LocalDate startDate, LocalDate endDate, Instant asOf) {
        return orderJpaRepository.countDistinctPaidBuyerId(startDate, endDate, asOf);
    }

    @Override
    public long countDistinctPaidSellerId(LocalDate startDate, LocalDate endDate) {
        return orderJpaRepository.countDistinctPaidSellerId(startDate, endDate);
    }

    @Override
    public long countDistinctPaidSellerId(LocalDate startDate, LocalDate endDate, Instant asOf) {
        return orderJpaRepository.countDistinctPaidSellerId(startDate, endDate, asOf);
    }

    @Override
    public List<RevenueByDate> paidGmvByDateBetween(LocalDate startDate, LocalDate endDate) {
        return orderJpaRepository.paidGmvByDateBetween(startDate, endDate).stream()
                .map(r -> new RevenueByDate(r.date(), r.revenue()))
                .toList();
    }

    @Override
    public List<RevenueByDate> paidGmvByDateBetween(LocalDate startDate, LocalDate endDate, Instant asOf) {
        return orderJpaRepository.paidGmvByDateBetween(startDate, endDate, asOf).stream()
                .map(r -> new RevenueByDate(r.date(), r.revenue()))
                .toList();
    }

    @Override
    public List<TopMetric> topProductsByUnitsSold(LocalDate startDate, LocalDate endDate, int limit) {
        return orderJpaRepository.topProductsByUnitsSold(startDate, endDate, limit).stream()
                .map(m -> new TopMetric(m.id(), m.name(), m.value()))
                .toList();
    }

    @Override
    public List<TopMetric> topProductsByUnitsSold(
            LocalDate startDate, LocalDate endDate, int limit, Instant asOf) {
        return orderJpaRepository.topProductsByUnitsSold(startDate, endDate, limit, asOf).stream()
                .map(m -> new TopMetric(m.id(), m.name(), m.value()))
                .toList();
    }

    @Override
    public List<TopMetric> topSellersByPaidGmv(LocalDate startDate, LocalDate endDate, int limit) {
        return orderJpaRepository.topSellersByPaidGmv(startDate, endDate, limit).stream()
                .map(m -> new TopMetric(m.id(), m.name(), m.value()))
                .toList();
    }

    @Override
    public List<TopMetric> topSellersByPaidGmv(
            LocalDate startDate, LocalDate endDate, int limit, Instant asOf) {
        return orderJpaRepository.topSellersByPaidGmv(startDate, endDate, limit, asOf).stream()
                .map(m -> new TopMetric(m.id(), m.name(), m.value()))
                .toList();
    }
}
