package com.vnshop.orderservice.infrastructure.web.admin;

import com.vnshop.orderservice.domain.DashboardSummary;
import java.math.BigDecimal;
import java.time.LocalDate;

public record DashboardSummaryResponse(
        long totalOrders,
        BigDecimal totalRevenue,
        long activeBuyers,
        long activeSellers,
        BigDecimal avgOrderValue,
        LocalDate periodStart,
        LocalDate periodEnd
) {
    static DashboardSummaryResponse fromDomain(DashboardSummary summary) {
        return new DashboardSummaryResponse(
                summary.totalOrders(),
                summary.totalRevenue(),
                summary.activeBuyers(),
                summary.activeSellers(),
                summary.avgOrderValue(),
                summary.periodStart(),
                summary.periodEnd()
        );
    }
}
