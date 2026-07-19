package com.vnshop.orderservice.infrastructure.web.admin;

import com.vnshop.orderservice.domain.RevenueTimeSeries;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record RevenueTimeSeriesResponse(List<PointResponse> points) {
    static RevenueTimeSeriesResponse fromDomain(RevenueTimeSeries series) {
        return new RevenueTimeSeriesResponse(series.points().stream()
                .map(PointResponse::fromDomain)
                .toList());
    }

    public record PointResponse(LocalDate date, BigDecimal revenue) {
        static PointResponse fromDomain(RevenueTimeSeries.Point point) {
            return new PointResponse(point.date(), point.revenue());
        }
    }
}
