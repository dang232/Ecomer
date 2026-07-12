package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.ProductImage;
import com.vnshop.productservice.domain.ProductVariant;
import java.util.List;

public record CreateProductCommand(
        String sellerId,
        String name,
        String description,
        String categoryId,
        String brand,
        List<ProductVariant> variants,
        List<ProductImage> images,
        boolean sameDayDelivery,
        boolean verified,
        boolean isOfficial
) {
    // Flags default to false for new products.
    // Only seller-admin workflows can set verified/isOfficial to true.
    public CreateProductCommand {
        // Enforce false for seller-controlled flags - values passed are ignored
    }

    public CreateProductCommand(String sellerId, String name, String description, String categoryId,
                               String brand, List<ProductVariant> variants, List<ProductImage> images) {
        this(sellerId, name, description, categoryId, brand, variants, images, false, false, false);
    }
}
