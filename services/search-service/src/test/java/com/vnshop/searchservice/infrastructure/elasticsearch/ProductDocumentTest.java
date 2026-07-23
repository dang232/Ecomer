package com.vnshop.searchservice.infrastructure.elasticsearch;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class ProductDocumentTest {

    @Test
    void mapsCatalogMediaAndStockFromProductEvents() {
        ProductDocument document = ProductDocument.fromEvent(
                "product-1",
                Map.of(
                        "name", "Headphones",
                        "imageUrl", "https://cdn.example/headphones.jpg",
                        "stock", 9,
                        "averageRating", 4.5,
                        "reviewCount", 8
                )
        );

        assertThat(document.getImageUrls())
                .containsExactly("https://cdn.example/headphones.jpg");
        assertThat(document.getStock()).isEqualTo(9);
        assertThat(document.getAverageRating()).isEqualTo(4.5f);
        assertThat(document.getReviewCount()).isEqualTo(8);
    }
}
