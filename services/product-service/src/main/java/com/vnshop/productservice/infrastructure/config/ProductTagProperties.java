package com.vnshop.productservice.infrastructure.config;

import com.vnshop.productservice.domain.ProductTagPolicy;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "product.tags")
public record ProductTagProperties(int maxPerProduct, int maxLength, int maxTotalLength) {
    public ProductTagPolicy toPolicy() {
        return new ProductTagPolicy(maxPerProduct, maxLength, maxTotalLength);
    }
}
