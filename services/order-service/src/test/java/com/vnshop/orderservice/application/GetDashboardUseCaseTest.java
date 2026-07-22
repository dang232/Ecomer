package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.orderservice.domain.DashboardSummary;
import com.vnshop.orderservice.domain.DashboardReport;
import com.vnshop.orderservice.domain.DashboardQuery;
import com.vnshop.orderservice.domain.DashboardGranularity;
import com.vnshop.orderservice.domain.RevenueTimeSeries;
import com.vnshop.orderservice.domain.TopProduct;
import com.vnshop.orderservice.domain.TopSeller;
import com.vnshop.orderservice.domain.port.out.DashboardAnalyticsPort;
import com.vnshop.orderservice.domain.port.out.UserDirectoryPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.ArrayList;
import org.junit.jupiter.api.Test;

class GetDashboardUseCaseTest {

    private static final LocalDate END = LocalDate.of(2026, 7, 23);
    private static final Clock CLOCK = Clock.fixed(
            Instant.parse("2026-07-23T12:00:00Z"), ZoneOffset.UTC);

    @Test
    void usesPaidMetricsForTheRequestedWindowAndSeparatesProductUnits() {
        StubAnalytics analytics = new StubAnalytics();
        analytics.paidOrders = 3;
        analytics.paidGmv = new BigDecimal("1250000");
        analytics.refundedAmount = new BigDecimal("100000");
        analytics.activeBuyers = 2;
        analytics.activeSellers = 2;
        analytics.products = List.of(new DashboardAnalyticsPort.TopMetric("p-1", "Headset", BigDecimal.valueOf(7)));
        analytics.sellers = List.of(new DashboardAnalyticsPort.TopMetric("s-1", "s-1", new BigDecimal("900000")));

        GetDashboardUseCase useCase = new GetDashboardUseCase(
                analytics,
                (buyers, sellers) -> new UserDirectoryPort.DirectorySnapshot(
                        Map.of(), Map.of("s-1", "Audio Shop")),
                CLOCK);
        DashboardQuery query = new DashboardQuery(
                END.minusDays(6), END, DashboardGranularity.DAY, 5);

        DashboardSummary summary = useCase.summary(query);
        List<TopProduct> products = useCase.topProducts(query);
        List<TopSeller> sellers = useCase.topSellers(query);

        assertThat(summary.paidGmv()).isEqualByComparingTo("1250000");
        assertThat(summary.refundedAmount()).isEqualByComparingTo("100000");
        assertThat(summary.realizedRevenue()).isEqualByComparingTo("1150000");
        assertThat(summary.totalOrders()).isEqualTo(3);
        assertThat(summary.activeBuyers()).isEqualTo(2);
        assertThat(summary.avgPaidOrderValue()).isEqualByComparingTo("416666.67");
        assertThat(analytics.lastStart).isEqualTo(END.minusDays(6));
        assertThat(analytics.lastEnd).isEqualTo(END);
        assertThat(products.getFirst().unitsSold()).isEqualTo(7);
        assertThat(sellers.getFirst().shopName()).isEqualTo("Audio Shop");
        assertThat(sellers.getFirst().paidGmv()).isEqualByComparingTo("900000");
    }

    @Test
    void rejectsInvalidDashboardWindowsAndLimits() {
        assertThatThrownBy(() -> new DashboardQuery(
                END, END.minusDays(1), DashboardGranularity.DAY, 5))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new DashboardQuery(
                END.minusDays(1), END, DashboardGranularity.DAY, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new DashboardQuery(
                END.minusDays(1), END, DashboardGranularity.DAY, 201))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reportUsesOneClockSnapshotForEveryWidget() {
        StubAnalytics analytics = new StubAnalytics();
        GetDashboardUseCase useCase = new GetDashboardUseCase(
                analytics,
                (buyers, sellers) -> UserDirectoryPort.DirectorySnapshot.empty(),
                CLOCK);

        DashboardReport report = useCase.report(new DashboardQuery(
                END.minusDays(6), END, DashboardGranularity.DAY, 5));

        assertThat(report.asOf()).isEqualTo(CLOCK.instant());
        assertThat(analytics.snapshots).containsOnly(CLOCK.instant());
    }

    @Test
    void reportReusesAnExplicitSnapshotTimestampForEveryWidget() {
        StubAnalytics analytics = new StubAnalytics();
        GetDashboardUseCase useCase = new GetDashboardUseCase(
                analytics,
                (buyers, sellers) -> UserDirectoryPort.DirectorySnapshot.empty(),
                CLOCK);
        Instant requestedSnapshot = Instant.parse("2026-07-23T08:30:00Z");

        DashboardReport report = useCase.report(new DashboardQuery(
                END.minusDays(6), END, DashboardGranularity.DAY, 5, requestedSnapshot));

        assertThat(report.asOf()).isEqualTo(requestedSnapshot);
        assertThat(analytics.snapshots).containsOnly(requestedSnapshot);
    }

    @Test
    void revenueSeparatesPartialRefundsFromPaidGmvByOrderCohortDate() {
        StubAnalytics analytics = new StubAnalytics();
        analytics.paidRows = List.of(
                new DashboardAnalyticsPort.RevenueByDate(END.minusDays(1), new BigDecimal("1000000")),
                new DashboardAnalyticsPort.RevenueByDate(END, new BigDecimal("2000000")));
        analytics.refundRows = List.of(
                new com.vnshop.orderservice.domain.RefundByDate(END.minusDays(1), new BigDecimal("250000")));

        GetDashboardUseCase useCase = new GetDashboardUseCase(analytics, (
                buyers, sellers) -> UserDirectoryPort.DirectorySnapshot.empty(), CLOCK);
        var revenue = useCase.revenue(new DashboardQuery(
                END.minusDays(1), END, DashboardGranularity.DAY, 5));

        assertThat(revenue.points()).extracting(RevenueTimeSeries.Point::paidGmv)
                .containsExactly(new BigDecimal("1000000"), new BigDecimal("2000000"));
        assertThat(revenue.points()).extracting(RevenueTimeSeries.Point::refundedAmount)
                .containsExactly(new BigDecimal("250000"), BigDecimal.ZERO);
        assertThat(revenue.points()).extracting(RevenueTimeSeries.Point::realizedRevenue)
                .containsExactly(new BigDecimal("750000"), new BigDecimal("2000000"));
    }

    private static final class StubAnalytics implements DashboardAnalyticsPort {
        long paidOrders;
        BigDecimal paidGmv = BigDecimal.ZERO;
        BigDecimal refundedAmount = BigDecimal.ZERO;
        long activeBuyers;
        long activeSellers;
        List<TopMetric> products = List.of();
        List<TopMetric> sellers = List.of();
        List<RevenueByDate> paidRows = List.of();
        List<com.vnshop.orderservice.domain.RefundByDate> refundRows = List.of();
        LocalDate lastStart;
        LocalDate lastEnd;
        List<Instant> snapshots = new ArrayList<>();

        @Override
        public long countByDateBetween(LocalDate startDate, LocalDate endDate) {
            return 0;
        }

        @Override
        public BigDecimal sumRevenueByDateBetween(LocalDate startDate, LocalDate endDate) {
            return BigDecimal.ZERO;
        }

        @Override
        public long countDistinctBuyerId(LocalDate startDate, LocalDate endDate) {
            return 0;
        }

        @Override
        public long countDistinctSellerId(LocalDate startDate, LocalDate endDate) {
            return 0;
        }

        @Override
        public List<RevenueByDate> revenueByDateBetween(LocalDate startDate, LocalDate endDate) {
            return List.of();
        }

        @Override
        public List<TopMetric> topProducts(int limit) {
            return List.of();
        }

        @Override
        public List<TopMetric> topSellers(int limit) {
            return List.of();
        }

        @Override
        public List<SellerRevenueByDate> sellerRevenueByDateBetween(String sellerId, LocalDate startDate, LocalDate endDate) {
            return List.of();
        }

        @Override
        public long countPaidOrdersBetween(LocalDate startDate, LocalDate endDate) {
            lastStart = startDate;
            lastEnd = endDate;
            return paidOrders;
        }

        @Override
        public BigDecimal sumPaidGmvByDateBetween(LocalDate startDate, LocalDate endDate) {
            lastStart = startDate;
            lastEnd = endDate;
            return paidGmv;
        }

        @Override
        public BigDecimal sumRefundedAmountBetween(LocalDate startDate, LocalDate endDate, Instant asOf) {
            snapshots.add(asOf);
            return refundedAmount;
        }

        @Override
        public long countPaidOrdersBetween(LocalDate startDate, LocalDate endDate, Instant asOf) {
            snapshots.add(asOf);
            lastStart = startDate;
            lastEnd = endDate;
            return paidOrders;
        }

        @Override
        public BigDecimal sumPaidGmvByDateBetween(LocalDate startDate, LocalDate endDate, Instant asOf) {
            snapshots.add(asOf);
            lastStart = startDate;
            lastEnd = endDate;
            return paidGmv;
        }

        @Override
        public long countDistinctPaidBuyerId(LocalDate startDate, LocalDate endDate, Instant asOf) {
            snapshots.add(asOf);
            return activeBuyers;
        }

        @Override
        public long countDistinctPaidSellerId(LocalDate startDate, LocalDate endDate, Instant asOf) {
            snapshots.add(asOf);
            return activeSellers;
        }

        @Override
        public List<RevenueByDate> paidGmvByDateBetween(LocalDate startDate, LocalDate endDate, Instant asOf) {
            snapshots.add(asOf);
            return paidRows;
        }

        @Override
        public List<TopMetric> topProductsByUnitsSold(
                LocalDate startDate, LocalDate endDate, int limit, Instant asOf) {
            snapshots.add(asOf);
            return products;
        }

        @Override
        public List<TopMetric> topSellersByPaidGmv(
                LocalDate startDate, LocalDate endDate, int limit, Instant asOf) {
            snapshots.add(asOf);
            return sellers;
        }

        @Override
        public List<com.vnshop.orderservice.domain.RefundByDate> refundedAmountByDateBetween(
                LocalDate startDate, LocalDate endDate, Instant asOf) {
            snapshots.add(asOf);
            return refundRows;
        }

        @Override
        public long countDistinctPaidBuyerId(LocalDate startDate, LocalDate endDate) {
            return activeBuyers;
        }

        @Override
        public long countDistinctPaidSellerId(LocalDate startDate, LocalDate endDate) {
            return activeSellers;
        }

        @Override
        public List<RevenueByDate> paidGmvByDateBetween(LocalDate startDate, LocalDate endDate) {
            return List.of();
        }

        @Override
        public List<TopMetric> topProductsByUnitsSold(LocalDate startDate, LocalDate endDate, int limit) {
            return products;
        }

        @Override
        public List<TopMetric> topSellersByPaidGmv(LocalDate startDate, LocalDate endDate, int limit) {
            return sellers;
        }
    }
}
