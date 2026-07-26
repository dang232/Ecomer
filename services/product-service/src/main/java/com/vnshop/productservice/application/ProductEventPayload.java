package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.review.ProductReviewSummary;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class ProductEventPayload {
    private ProductEventPayload() {
    }

    public static Map<String, Object> from(Product product) {
        return basePayload(product);
    }

    public static Map<String, Object> from(Product product, ProductReviewSummary reviewSummary) {
        Map<String, Object> payload = basePayload(product);
        payload.put("reviewCount", reviewSummary.reviewCount());
        putIfNotNull(payload, "averageRating", reviewSummary.averageRating());
        return payload;
    }

    private static Map<String, Object> basePayload(Product product) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sellerId", product.sellerId());
        putIfNotNull(payload, "name", product.name());
        putIfNotNull(payload, "description", product.description());
        putIfNotNull(payload, "categoryId", product.categoryId());
        putIfNotNull(payload, "brand", product.brand());
        payload.put("status", product.status().name());
        payload.put("variantCount", product.variants().size());
        payload.put("stock", product.variants().stream()
                .mapToInt(variant -> variant.stockQuantity())
                .sum());
        payload.put("sameDayDelivery", product.sameDayDelivery());
        payload.put("verified", product.verified());
        payload.put("isOfficial", product.isOfficial());
        payload.put("tags", product.tags().stream()
                .map(tag -> Map.of("key", tag.canonicalKey(), "label", tag.displayLabel()))
                .toList());

        product.images().stream()
                .min((left, right) -> Integer.compare(left.sortOrder(), right.sortOrder()))
                .ifPresent(image -> payload.put("imageUrl", image.url()));

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
