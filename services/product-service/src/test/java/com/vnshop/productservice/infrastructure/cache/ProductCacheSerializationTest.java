package com.vnshop.productservice.infrastructure.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import com.vnshop.productservice.domain.Money;
import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.ProductImage;
import com.vnshop.productservice.domain.ProductVariant;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;

class ProductCacheSerializationTest {

    @Test
    void productCacheSerializerRoundTripsPublishedProduct() {
        Product product = new Product(
                UUID.randomUUID(),
                "seller-1",
                "Cache product",
                "A product stored in Redis",
                "electronics",
                "VNShop",
                List.of(new ProductVariant("SKU-1", "Standard", new Money(new BigDecimal("199000")), null, 3)),
                List.of(new ProductImage("https://example.test/product.png", "Product", 1)),
                true,
                true,
                false);
        product.publish();

        GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer();
        Object restored = serializer.deserialize(serializer.serialize(product));

        Product restoredProduct = assertInstanceOf(Product.class, restored);
        assertEquals(product.productId(), restoredProduct.productId());
        assertEquals(product.status(), restoredProduct.status());
        assertEquals(product.variants(), restoredProduct.variants());
        assertEquals(product.images(), restoredProduct.images());
    }
}
