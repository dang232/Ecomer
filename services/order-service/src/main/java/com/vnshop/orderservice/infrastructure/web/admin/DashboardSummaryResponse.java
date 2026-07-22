package com.vnshop.orderservice.infrastructure.web.admin;

import com.vnshop.orderservice.domain.DashboardSummary;
import java.math.BigDecimal;
import java.time.LocalDate;

public record DashboardSummaryResponse(
        long totalOrders,
        BigDecimal paidGmv,
        BigDecimal refundedAmount,
        BigDecimal realizedRevenue,
        long activeBuyers,
        long activeSellers,
        BigDecimal avgPaidOrderValue,
        LocalDate periodStart,
        LocalDate periodEnd
) {
    static DashboardSummaryResponse fromDomain(DashboardSummary summary) {
        return new DashboardSummaryResponse(
                summary.totalOrders(),
                summary.paidGmv(),
                summary.refundedAmount(),
                summary.realizedRevenue(),
                summary.activeBuyers(),
                summary.activeSellers(),
                summary.avgPaidOrderValue(),
                summary.periodStart(),
                summary.periodEnd()
        );
    }
}
