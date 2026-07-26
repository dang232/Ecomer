package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.ProductImage;
import com.vnshop.productservice.domain.ProductTag;
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
        List<ProductTag> tags,
        boolean sameDayDelivery,
        boolean verified,
        boolean isOfficial
) {
    // Flags default to false for new products created via the 6-arg constructor.
    // Only seller-admin workflows pass true for verified/isOfficial.
    // Flags are preserved from the constructor arguments — callers are responsible
    // for setting them to false when creating regular products.

    public CreateProductCommand(String sellerId, String name, String description, String categoryId,
                               String brand, List<ProductVariant> variants, List<ProductImage> images) {
        this(sellerId, name, description, categoryId, brand, variants, images, List.of(), false, false, false);
    }

    public CreateProductCommand(String sellerId, String name, String description, String categoryId,
                               String brand, List<ProductVariant> variants, List<ProductImage> images,
                               List<ProductTag> tags) {
        this(sellerId, name, description, categoryId, brand, variants, images, tags, false, false, false);
    }
}
