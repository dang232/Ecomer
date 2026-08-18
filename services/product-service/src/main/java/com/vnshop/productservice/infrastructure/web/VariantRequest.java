package com.vnshop.productservice.infrastructure.web;

import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.ProductVariant;
import java.math.BigDecimal;

public record VariantRequest(
        String sku,
        String name,
        BigDecimal priceAmount,
        String priceCurrency,
        String imageUrl,
        Integer stockQuantity,
        ParcelRequest parcel
) {
    ProductVariant toDomain() {
        int stock = stockQuantity == null ? 0 : stockQuantity;
        return new ProductVariant(
                sku,
                name,
                new Money(priceAmount, priceCurrency),
                imageUrl,
                stock,
                parcel == null ? null : parcel.toDomain());
    }

    public VariantRequest(
            String sku,
            String name,
            BigDecimal priceAmount,
            String priceCurrency,
            String imageUrl,
            Integer stockQuantity) {
        this(sku, name, priceAmount, priceCurrency, imageUrl, stockQuantity, null);
    }

    public record ParcelRequest(
            Integer weightGrams,
            Integer lengthCm,
            Integer widthCm,
            Integer heightCm) {
        private com.vnshop.productservice.domain.ParcelDimensions toDomain() {
            if (weightGrams == null || lengthCm == null || widthCm == null || heightCm == null) {
                throw new IllegalArgumentException("parcel metadata must be complete");
            }
            return new com.vnshop.productservice.domain.ParcelDimensions(
                    weightGrams, lengthCm, widthCm, heightCm);
        }
    }
}
