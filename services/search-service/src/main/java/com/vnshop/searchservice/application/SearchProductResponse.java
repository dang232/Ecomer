package com.vnshop.searchservice.application;

import com.vnshop.searchservice.domain.ProductReadModel;
import java.math.BigDecimal;

public record SearchProductResponse(
        String productId,
        String name,
        String description,
        String categoryId,
        String brand,
        String status,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        int variantCount,
        boolean sameDayDelivery,
        boolean verified,
        boolean isOfficial
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
                model.variantCount(),
                model.sameDayDelivery(),
                model.verified(),
                model.isOfficial()
        );
    }
}
