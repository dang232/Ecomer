package com.vnshop.orderservice.application;

import com.vnshop.orderservice.domain.DashboardGranularity;
import com.vnshop.orderservice.domain.DashboardReport;
import com.vnshop.orderservice.domain.DashboardQuery;
import com.vnshop.orderservice.domain.DashboardSummary;
import com.vnshop.orderservice.domain.RevenueTimeSeries;
import com.vnshop.orderservice.domain.TopProduct;
import com.vnshop.orderservice.domain.TopSeller;
import com.vnshop.orderservice.domain.port.out.DashboardAnalyticsPort;
import com.vnshop.orderservice.domain.port.out.UserDirectoryPort;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;

/**
 * Admin dashboard read model. Money is paid GMV: payment-completed order
 * totals before refund deductions. Product rankings are quantities, not money.
 */
public class GetDashboardUseCase {
    private final DashboardAnalyticsPort analytics;
    private final UserDirectoryPort userDirectoryPort;
    private final Clock clock;

    public GetDashboardUseCase(DashboardAnalyticsPort analytics) {
        this(analytics, (buyers, sellers) -> UserDirectoryPort.DirectorySnapshot.empty(), Clock.systemUTC());
    }

    public GetDashboardUseCase(
            DashboardAnalyticsPort analytics,
            UserDirectoryPort userDirectoryPort,
            Clock clock
    ) {
        this.analytics = Objects.requireNonNull(analytics, "analytics is required");
        this.userDirectoryPort = Objects.requireNonNull(userDirectoryPort, "userDirectoryPort is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public DashboardSummary summary() {
        return summary(defaultQuery());
    }

    public DashboardSummary summary(DashboardQuery query) {
        return summary(query, Instant.now(clock));
    }

    public DashboardSummary summary(DashboardQuery query, Instant asOf) {
        long totalOrders = analytics.countPaidOrdersBetween(query.from(), query.to(), asOf);
        BigDecimal paidGmv = analytics.sumPaidGmvByDateBetween(query.from(), query.to(), asOf);
        BigDecimal refundedAmount = analytics.sumRefundedAmountBetween(query.from(), query.to(), asOf);
        BigDecimal realizedRevenue = paidGmv.subtract(refundedAmount);
        long activeBuyers = analytics.countDistinctPaidBuyerId(query.from(), query.to(), asOf);
        long activeSellers = analytics.countDistinctPaidSellerId(query.from(), query.to(), asOf);
        BigDecimal averagePaidOrderValue = totalOrders == 0
                ? BigDecimal.ZERO
                : paidGmv.divide(BigDecimal.valueOf(totalOrders), 2, RoundingMode.HALF_UP);

        return new DashboardSummary(
                totalOrders,
                paidGmv,
                refundedAmount,
                realizedRevenue,
                activeBuyers,
                activeSellers,
                averagePaidOrderValue,
                query.from(),
                query.to());
    }

    public RevenueTimeSeries revenue() {
        return revenue(defaultQuery());
    }

    public RevenueTimeSeries revenue(DashboardQuery query) {
        return revenue(query, Instant.now(clock));
    }

    public RevenueTimeSeries revenue(DashboardQuery query, Instant asOf) {
        Map<LocalDate, BigDecimal> daily = new HashMap<>();
        Map<LocalDate, BigDecimal> refunded = new HashMap<>();
        analytics.paidGmvByDateBetween(query.from(), query.to(), asOf).forEach(row ->
                daily.merge(row.date(), row.revenue(), BigDecimal::add));
        analytics.refundedAmountByDateBetween(query.from(), query.to(), asOf).forEach(row ->
                refunded.merge(row.date(), row.amount(), BigDecimal::add));

        if (query.granularity() == DashboardGranularity.DAY) {
            List<RevenueTimeSeries.Point> points = new ArrayList<>();
            for (LocalDate date = query.from(); !date.isAfter(query.to()); date = date.plusDays(1)) {
                BigDecimal paid = daily.getOrDefault(date, BigDecimal.ZERO);
                BigDecimal refund = refunded.getOrDefault(date, BigDecimal.ZERO);
                points.add(new RevenueTimeSeries.Point(date, paid, refund, paid.subtract(refund)));
            }
            return new RevenueTimeSeries(points);
        }

        Map<LocalDate, BigDecimal> buckets = new TreeMap<>();
        Map<LocalDate, BigDecimal> refundBuckets = new TreeMap<>();
        for (LocalDate date = query.from(); !date.isAfter(query.to()); date = date.plusDays(1)) {
            LocalDate bucket = bucketStart(date, query.granularity());
            buckets.merge(bucket, daily.getOrDefault(date, BigDecimal.ZERO), BigDecimal::add);
            refundBuckets.merge(bucket, refunded.getOrDefault(date, BigDecimal.ZERO), BigDecimal::add);
        }
        return new RevenueTimeSeries(buckets.entrySet().stream()
                .map(entry -> new RevenueTimeSeries.Point(
                        entry.getKey(),
                        entry.getValue(),
                        refundBuckets.getOrDefault(entry.getKey(), BigDecimal.ZERO),
                        entry.getValue().subtract(refundBuckets.getOrDefault(entry.getKey(), BigDecimal.ZERO))))
                .toList());
    }

    public List<TopProduct> topProducts() {
        return topProducts(defaultQuery());
    }

    public List<TopProduct> topProducts(DashboardQuery query) {
        return topProducts(query, Instant.now(clock));
    }

    public List<TopProduct> topProducts(DashboardQuery query, Instant asOf) {
        return analytics.topProductsByUnitsSold(query.from(), query.to(), query.limit(), asOf).stream()
                .map(metric -> new TopProduct(metric.id(), metric.name(), metric.value().longValue()))
                .toList();
    }

    public List<TopSeller> topSellers() {
        return topSellers(defaultQuery());
    }

    public List<TopSeller> topSellers(DashboardQuery query) {
        return topSellers(query, Instant.now(clock));
    }

    public List<TopSeller> topSellers(DashboardQuery query, Instant asOf) {
        List<DashboardAnalyticsPort.TopMetric> metrics = analytics.topSellersByPaidGmv(
                query.from(), query.to(), query.limit(), asOf);
        var sellerIds = metrics.stream().map(DashboardAnalyticsPort.TopMetric::id).collect(java.util.stream.Collectors.toSet());
        var names = userDirectoryPort.lookup(Set.of(), sellerIds).sellerNames();
        return metrics.stream()
                .map(metric -> new TopSeller(metric.id(), names.get(metric.id()), metric.value()))
                .toList();
    }

    public DashboardReport report(DashboardQuery query) {
        Instant asOf = query.asOf() == null ? Instant.now(clock) : query.asOf();
        DashboardQuery snapshotQuery = query.withAsOf(asOf);
        return new DashboardReport(
                asOf,
                snapshotQuery.from(),
                snapshotQuery.to(),
                summary(snapshotQuery, asOf),
                revenue(snapshotQuery, asOf),
                topProducts(snapshotQuery, asOf),
                topSellers(snapshotQuery, asOf));
    }

    private DashboardQuery defaultQuery() {
        return DashboardQuery.defaultFor(LocalDate.now(clock));
    }

    private static LocalDate bucketStart(LocalDate date, DashboardGranularity granularity) {
        return switch (granularity) {
            case WEEK -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> date.withDayOfMonth(1);
            case DAY -> date;
        };
    }
}
