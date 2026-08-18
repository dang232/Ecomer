package com.vnshop.orderservice.domain;

import java.math.BigDecimal;
import java.util.Objects;

public record OrderItem(
        String productId,
        String variantSku,
        String sellerId,
        String name,
        int quantity,
        Money unitPrice,
        String imageUrl,
        ParcelDimensions parcel,
        BigDecimal taxRate,
        BigDecimal taxAmount
) {
    public OrderItem(String productId, String variantSku, String sellerId, String name, int quantity,
                     Money unitPrice, String imageUrl) {
        this(productId, variantSku, sellerId, name, quantity, unitPrice, imageUrl, null, null, null);
    }

    public OrderItem(String productId, String variantSku, String sellerId, String name, int quantity,
                     Money unitPrice, String imageUrl, ParcelDimensions parcel) {
        this(productId, variantSku, sellerId, name, quantity, unitPrice, imageUrl, parcel, null, null);
    }

    public OrderItem(String productId, String variantSku, String sellerId, String name, int quantity,
                     Money unitPrice, String imageUrl, BigDecimal taxRate, BigDecimal taxAmount) {
        this(productId, variantSku, sellerId, name, quantity, unitPrice, imageUrl, null, taxRate, taxAmount);
    }

    public OrderItem {
        requireNonBlank(productId, "productId");
        requireNonBlank(variantSku, "variantSku");
        requireNonBlank(sellerId, "sellerId");
        requireNonBlank(name, "name");
        if (quantity <= 0) {
            throw new IllegalArgumentException("quantity must be greater than zero");
        }
        Objects.requireNonNull(unitPrice, "unitPrice is required");
        if (taxRate != null && taxRate.signum() < 0) {
            throw new IllegalArgumentException("taxRate cannot be negative");
        }
        if (taxAmount != null && taxAmount.signum() < 0) {
            throw new IllegalArgumentException("taxAmount cannot be negative");
        }
    }

    public Money totalPrice() {
        return new Money(unitPrice.amount().multiply(java.math.BigDecimal.valueOf(quantity)), unitPrice.currency());
    }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
