package com.vnshop.searchservice.application;

import java.util.Locale;

public enum CursorSort {
    NEWEST("newest"),
    PRICE_LOW("price-low"),
    PRICE_HIGH("price-high");

    private final String wireValue;

    CursorSort(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }

    public static CursorSort parse(String value) {
        if (value == null || value.isBlank()) {
            return NEWEST;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        for (CursorSort candidate : values()) {
            if (candidate.wireValue.equals(normalized)) {
                return candidate;
            }
        }
        throw new IllegalArgumentException("unsupported cursor sort: " + value);
    }
}
