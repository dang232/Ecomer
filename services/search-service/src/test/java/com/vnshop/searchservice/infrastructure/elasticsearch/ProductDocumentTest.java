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
                        "stock", 9
                )
        );

        assertThat(document.getImageUrls())
                .containsExactly("https://cdn.example/headphones.jpg");
        assertThat(document.getStock()).isEqualTo(9);
    }
}
