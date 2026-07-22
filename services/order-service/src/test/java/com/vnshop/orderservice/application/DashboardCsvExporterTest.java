package com.vnshop.orderservice.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.orderservice.domain.DashboardReport;
import com.vnshop.orderservice.domain.DashboardSummary;
import com.vnshop.orderservice.domain.RevenueTimeSeries;
import com.vnshop.orderservice.domain.TopProduct;
import com.vnshop.orderservice.domain.TopSeller;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class DashboardCsvExporterTest {
    @Test
    void exportsTheSameSnapshotMetricsWithEscapedDisplayNames() {
        DashboardSummary summary = new DashboardSummary(
                3,
                new BigDecimal("1250000"),
                new BigDecimal("100000"),
                new BigDecimal("1150000"),
                2,
                1,
                new BigDecimal("416666.67"),
                LocalDate.of(2026, 7, 17),
                LocalDate.of(2026, 7, 23));
        DashboardReport report = new DashboardReport(
                Instant.parse("2026-07-23T12:00:00Z"),
                summary.periodStart(),
                summary.periodEnd(),
                summary,
                new RevenueTimeSeries(List.of(new RevenueTimeSeries.Point(
                        LocalDate.of(2026, 7, 22),
                        new BigDecimal("1250000"),
                        new BigDecimal("100000"),
                        new BigDecimal("1150000")))),
                List.of(new TopProduct("p-1", "Headphones", 7)),
                List.of(new TopSeller("s-1", "Shop, One", new BigDecimal("900000"))));

        String csv = new String(new DashboardCsvExporter().export(report));

        assertThat(csv).contains("summary,,,realizedRevenue,1150000,amount,VND");
        assertThat(csv).contains("top-product,,p-1,Headphones,7,count,");
        assertThat(csv).contains("top-seller,,s-1,\"Shop, One\",900000,amount,VND");
    }
}
