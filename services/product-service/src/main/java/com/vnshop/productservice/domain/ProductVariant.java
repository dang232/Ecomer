package com.vnshop.productservice.domain;

import java.util.Objects;

public record ProductVariant(
        String sku,
        String name,
        Money price,
        String imageUrl,
        int stockQuantity,
        ParcelDimensions parcel) {
    public ProductVariant {
        requireNonBlank(sku, "sku");
        Objects.requireNonNull(price, "price is required");
        if (stockQuantity < 0) {
            throw new IllegalArgumentException("stockQuantity must be >= 0");
        }
    }

    /**
     * Backwards-compatible constructor for callers that haven't started carrying stock yet.
     * Defaults stock to 0; existing rows in the database land here via the JPA mapper for
     * legacy entities written before the stock column existed.
     */
    public ProductVariant(String sku, String name, Money price, String imageUrl) {
        this(sku, name, price, imageUrl, 0, null);
    }

    public ProductVariant(String sku, String name, Money price, String imageUrl, int stockQuantity) {
        this(sku, name, price, imageUrl, stockQuantity, null);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof ProductVariant variant)) {
            return false;
        }
        return sku.equals(variant.sku);
    }

    @Override
    public int hashCode() {
        return sku.hashCode();
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
