package com.vnshop.productservice.infrastructure.web;

import com.vnshop.productservice.domain.ProductImage;
import com.vnshop.productservice.domain.ProductVariant;
import com.vnshop.productservice.domain.ProductTag;
import com.vnshop.productservice.domain.ProductTagNormalizer;
import java.util.List;

public record ProductRequest(String name, String description, String categoryId, String brand,
                             List<VariantRequest> variants, List<ImageRequest> images, List<String> tags) {
    List<ProductVariant> toVariants() {
        return variants == null ? List.of() : variants.stream().map(VariantRequest::toDomain).toList();
    }

    List<ProductImage> toImages() {
        return images == null ? List.of() : images.stream().map(ImageRequest::toDomain).toList();
    }

    List<ProductTag> toTags(ProductTagNormalizer normalizer) {
        return normalizer.normalize(tags);
    }
}
