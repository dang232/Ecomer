package com.vnshop.searchservice.application;

import com.vnshop.searchservice.domain.ProductReadModel;
import java.math.BigDecimal;
import java.util.List;

/**
 * Search response DTO aligned with frontend's productSummarySchema.
 * Uses 'id' (not 'productId') and 'price' (not 'minPrice') to match
 * the frontend's canonical shape and avoid Zod validation failures.
 */
public record SearchProductResponse(
        String id,
        String name,
        String description,
        String categoryId,
        String brand,
        String status,
        BigDecimal price,
        BigDecimal maxPrice,
        Float rating,
        Integer reviewCount,
        int variantCount,
        String imageUrl,
        int stock,
        boolean sameDayDelivery,
        boolean verified,
        boolean isOfficial,
        List<String> tags
) {
    public static SearchProductResponse fromDomain(ProductReadModel model) {
        return new SearchProductResponse(
                model.productId(),
                model.name(),
                model.description(),
                model.categoryId(),
                model.brand(),
                model.status(),
                model.minPrice(),
                model.maxPrice(),
                model.averageRating(),
                model.reviewCount(),
                model.variantCount(),
                model.imageUrl(),
                model.stock(),
                model.sameDayDelivery(),
                model.verified(),
                model.isOfficial(),
                model.tags()
        );
    }
}
