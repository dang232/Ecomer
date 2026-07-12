package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

final class ProductEventPayload {
    private ProductEventPayload() {
    }

    static Map<String, Object> from(Product product) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sellerId", product.sellerId());
        putIfNotNull(payload, "name", product.name());
        putIfNotNull(payload, "description", product.description());
        putIfNotNull(payload, "categoryId", product.categoryId());
        putIfNotNull(payload, "brand", product.brand());
        payload.put("status", product.status().name());
        payload.put("variantCount", product.variants().size());
        payload.put("sameDayDelivery", product.sameDayDelivery());
        payload.put("verified", product.verified());
        payload.put("isOfficial", product.isOfficial());

        product.variants().stream()
                .map(variant -> variant.price().amount())
                .min(BigDecimal::compareTo)
                .ifPresent(value -> payload.put("minPrice", value));
        product.variants().stream()
                .map(variant -> variant.price().amount())
                .max(BigDecimal::compareTo)
                .ifPresent(value -> payload.put("maxPrice", value));
        return payload;
    }

    private static void putIfNotNull(Map<String, Object> payload, String key, Object value) {
        if (value != null) {
            payload.put(key, value);
        }
    }
}
