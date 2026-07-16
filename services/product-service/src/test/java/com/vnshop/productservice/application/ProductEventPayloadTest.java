package com.vnshop.productservice.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductImage;
import com.vnshop.productservice.domain.ProductVariant;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProductEventPayloadTest {

    @Test
    void includesPrimaryImageAndTotalStockForCatalogConsumers() {
        Product product = new Product(
                UUID.randomUUID(),
                "seller-1",
                "Studio headphones",
                "Closed-back headphones",
                "audio",
                "VNShop",
                List.of(
                        new ProductVariant("black", "Black", new Money(new BigDecimal("1250000")), null, 3),
                        new ProductVariant("white", "White", new Money(new BigDecimal("1350000")), null, 5)
                ),
                List.of(
                        new ProductImage("https://cdn.example/side.jpg", "Side view", 2),
                        new ProductImage("https://cdn.example/front.jpg", "Front view", 1)
                )
        );

        Map<String, Object> payload = ProductEventPayload.from(product);

        assertThat(payload)
                .containsEntry("imageUrl", "https://cdn.example/front.jpg")
                .containsEntry("stock", 8);
    }
}
