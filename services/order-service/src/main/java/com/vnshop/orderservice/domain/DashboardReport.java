package com.vnshop.orderservice.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DashboardReport(
        Instant asOf,
        LocalDate periodStart,
        LocalDate periodEnd,
        DashboardSummary summary,
        RevenueTimeSeries revenue,
        List<TopProduct> topProducts,
        List<TopSeller> topSellers
) {
    public DashboardReport {
        topProducts = List.copyOf(topProducts);
        topSellers = List.copyOf(topSellers);
    }
}
