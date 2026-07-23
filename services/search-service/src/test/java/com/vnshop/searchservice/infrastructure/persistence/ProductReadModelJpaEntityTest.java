package com.vnshop.searchservice.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.searchservice.domain.ProductReadModel;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ProductReadModelJpaEntityTest {

    @Test
    void mapsCatalogMediaAndStockFromProductEvents() {
        ProductReadModel model = ProductReadModelJpaEntity.fromEvent(
                "product-1",
                Map.of(
                        "name", "Headphones",
                        "status", "ACTIVE",
                        "imageUrl", "https://cdn.example/headphones.jpg",
                        "stock", 9,
                        "averageRating", 4.0,
                        "reviewCount", 12
                )
        ).toDomain();

        assertThat(model.imageUrl()).isEqualTo("https://cdn.example/headphones.jpg");
        assertThat(model.stock()).isEqualTo(9);
        assertThat(model.averageRating()).isEqualTo(4.0f);
        assertThat(model.reviewCount()).isEqualTo(12);
    }
}
