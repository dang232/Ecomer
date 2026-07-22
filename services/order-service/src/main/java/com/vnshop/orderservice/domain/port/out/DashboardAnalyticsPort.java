package com.vnshop.orderservice.domain.port.out;

import com.vnshop.orderservice.domain.RefundByDate;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public interface DashboardAnalyticsPort {

    long countByDateBetween(LocalDate startDate, LocalDate endDate);

    BigDecimal sumRevenueByDateBetween(LocalDate startDate, LocalDate endDate);

    long countDistinctBuyerId(LocalDate startDate, LocalDate endDate);

    long countDistinctSellerId(LocalDate startDate, LocalDate endDate);

    List<RevenueByDate> revenueByDateBetween(LocalDate startDate, LocalDate endDate);

    List<TopMetric> topProducts(int limit);

    List<TopMetric> topSellers(int limit);

    /**
     * One seller's gross revenue (line-item total) and distinct sub-order count
     * grouped by UTC date for the closed range [startDate, endDate]. Days with
     * no orders are simply absent from the result; the use case pads them.
     */
    List<SellerRevenueByDate> sellerRevenueByDateBetween(String sellerId, LocalDate startDate, LocalDate endDate);

    default long countPaidOrdersBetween(LocalDate startDate, LocalDate endDate) {
        return countByDateBetween(startDate, endDate);
    }

    default long countPaidOrdersBetween(LocalDate startDate, LocalDate endDate, Instant asOf) {
        return countPaidOrdersBetween(startDate, endDate);
    }

    default BigDecimal sumPaidGmvByDateBetween(LocalDate startDate, LocalDate endDate) {
        return sumRevenueByDateBetween(startDate, endDate);
    }

    default BigDecimal sumPaidGmvByDateBetween(LocalDate startDate, LocalDate endDate, Instant asOf) {
        return sumPaidGmvByDateBetween(startDate, endDate);
    }

    default BigDecimal sumRefundedAmountBetween(LocalDate startDate, LocalDate endDate, Instant asOf) {
        return BigDecimal.ZERO;
    }

    default List<RefundByDate> refundedAmountByDateBetween(
            LocalDate startDate, LocalDate endDate, Instant asOf) {
        return List.of();
    }

    default long countDistinctPaidBuyerId(LocalDate startDate, LocalDate endDate) {
        return countDistinctBuyerId(startDate, endDate);
    }

    default long countDistinctPaidBuyerId(LocalDate startDate, LocalDate endDate, Instant asOf) {
        return countDistinctPaidBuyerId(startDate, endDate);
    }

    default long countDistinctPaidSellerId(LocalDate startDate, LocalDate endDate) {
        return countDistinctSellerId(startDate, endDate);
    }

    default long countDistinctPaidSellerId(LocalDate startDate, LocalDate endDate, Instant asOf) {
        return countDistinctPaidSellerId(startDate, endDate);
    }

    default List<RevenueByDate> paidGmvByDateBetween(LocalDate startDate, LocalDate endDate) {
        return revenueByDateBetween(startDate, endDate);
    }

    default List<RevenueByDate> paidGmvByDateBetween(
            LocalDate startDate, LocalDate endDate, Instant asOf) {
        return paidGmvByDateBetween(startDate, endDate);
    }

    default List<TopMetric> topProductsByUnitsSold(LocalDate startDate, LocalDate endDate, int limit) {
        return topProducts(limit);
    }

    default List<TopMetric> topProductsByUnitsSold(
            LocalDate startDate, LocalDate endDate, int limit, Instant asOf) {
        return topProductsByUnitsSold(startDate, endDate, limit);
    }

    default List<TopMetric> topSellersByPaidGmv(LocalDate startDate, LocalDate endDate, int limit) {
        return topSellers(limit);
    }

    default List<TopMetric> topSellersByPaidGmv(
            LocalDate startDate, LocalDate endDate, int limit, Instant asOf) {
        return topSellersByPaidGmv(startDate, endDate, limit);
    }

    record RevenueByDate(LocalDate date, BigDecimal revenue) {}

    record TopMetric(String id, String name, BigDecimal value) {}

    record SellerRevenueByDate(LocalDate date, BigDecimal revenue, long orderCount) {}
}
