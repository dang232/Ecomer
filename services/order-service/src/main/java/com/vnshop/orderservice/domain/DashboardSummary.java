package com.vnshop.orderservice.domain;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DashboardSummary(
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
}
