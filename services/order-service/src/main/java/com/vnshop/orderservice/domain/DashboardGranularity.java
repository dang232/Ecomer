package com.vnshop.orderservice.domain;

import java.util.Locale;

public enum DashboardGranularity {
    DAY,
    WEEK,
    MONTH;

    public static DashboardGranularity parse(String value) {
        if (value == null || value.isBlank()) {
            return DAY;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("granularity must be day, week, or month");
        }
    }
}
