package com.vnshop.productservice.application;

import java.util.Locale;

public enum CatalogCursorSort {
    NEWEST("newest"),
    PRICE_LOW("price-low"),
    PRICE_HIGH("price-high");

    private final String wireValue;

    CatalogCursorSort(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }

    public static CatalogCursorSort parse(String value) {
        if (value == null || value.isBlank()) {
            return NEWEST;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        for (CatalogCursorSort sort : values()) {
            if (sort.wireValue.equals(normalized)) {
                return sort;
            }
        }
        throw new IllegalArgumentException("unsupported cursor sort: " + value);
    }
}
