package com.vnshop.orderservice.domain;

import java.time.LocalDate;
import java.time.Instant;
import java.util.Objects;

public record DashboardQuery(
        LocalDate from,
        LocalDate to,
        DashboardGranularity granularity,
        int limit,
        Instant asOf
) {
    public DashboardQuery(LocalDate from, LocalDate to, DashboardGranularity granularity, int limit) {
        this(from, to, granularity, limit, null);
    }

    public DashboardQuery {
        Objects.requireNonNull(from, "from is required");
        Objects.requireNonNull(to, "to is required");
        Objects.requireNonNull(granularity, "granularity is required");
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("from must be on or before to");
        }
        if (from.plusDays(365).isBefore(to)) {
            throw new IllegalArgumentException("dashboard range cannot exceed 366 days");
        }
        if (limit < 1 || limit > 200) {
            throw new IllegalArgumentException("limit must be between 1 and 200");
        }
        if (asOf != null && asOf.isBefore(from.atStartOfDay(java.time.ZoneOffset.UTC).toInstant())) {
            throw new IllegalArgumentException("asOf must not be before the dashboard period");
        }
    }

    public static DashboardQuery defaultFor(LocalDate periodEnd) {
        Objects.requireNonNull(periodEnd, "periodEnd is required");
        return new DashboardQuery(periodEnd.minusDays(29), periodEnd, DashboardGranularity.DAY, 10);
    }

    public DashboardQuery withAsOf(Instant snapshot) {
        return new DashboardQuery(from, to, granularity, limit, snapshot);
    }
}
