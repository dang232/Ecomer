package com.vnshop.orderservice.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record RevenueTimeSeries(List<Point> points) {
    public record Point(LocalDate date, BigDecimal paidGmv, BigDecimal refundedAmount, BigDecimal realizedRevenue) {
        public Point(LocalDate date, BigDecimal paidGmv) {
            this(date, paidGmv, BigDecimal.ZERO, paidGmv);
        }
    }
}
