package com.vnshop.orderservice.infrastructure.web.admin;

import com.vnshop.orderservice.domain.DashboardReport;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DashboardReportResponse(
        Instant asOf,
        LocalDate periodStart,
        LocalDate periodEnd,
        DashboardSummaryResponse summary,
        RevenueTimeSeriesResponse revenue,
        List<TopProductResponse> topProducts,
        List<TopSellerResponse> topSellers
) {
    static DashboardReportResponse fromDomain(DashboardReport report) {
        return new DashboardReportResponse(
                report.asOf(),
                report.periodStart(),
                report.periodEnd(),
                DashboardSummaryResponse.fromDomain(report.summary()),
                RevenueTimeSeriesResponse.fromDomain(report.revenue()),
                report.topProducts().stream().map(TopProductResponse::fromDomain).toList(),
                report.topSellers().stream().map(TopSellerResponse::fromDomain).toList());
    }
}
